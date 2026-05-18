// @ts-check
/**
 * Expo Config Plugin — injects FamilyControls & ScreenBlocking native modules
 * and a DeviceActivityMonitor extension into the iOS project during
 * `expo prebuild` so EAS cloud builds include them.
 */
const { withXcodeProject, withEntitlementsPlist, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────

const kAppGroup = 'group.com.loqlearn.app';
const kExtBundleId = 'com.loqlearn.app.monitor';
const kExtName = 'UnloqMonitor';
const kShieldExtName = 'UnloqShield';
const kShieldBundleId = 'com.loqlearn.app.shield';

// ─── Swift / ObjC source content ─────────────────────────────────────────────

const FAMILY_CONTROLS_SWIFT = `\
import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI

private let kAppGroup = "${kAppGroup}"
private let kSelectionKey = "loqlearn.familyActivitySelection"
private let kCompletionDateKey = "loqlearn.lessonsCompletedDate"

@available(iOS 16, *)
extension DeviceActivityName {
  static let daily = Self("daily")
}

@objc(FamilyControlsModule)
class FamilyControlsModule: NSObject {

  private lazy var store = ManagedSettingsStore()

  private var savedSelection: FamilyActivitySelection {
    get {
      guard let data = UserDefaults(suiteName: kAppGroup)?.data(forKey: kSelectionKey),
            let sel = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
      else { return FamilyActivitySelection() }
      return sel
    }
    set {
      let data = try? PropertyListEncoder().encode(newValue)
      UserDefaults(suiteName: kAppGroup)?.set(data, forKey: kSelectionKey)
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func getAuthorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    switch AuthorizationCenter.shared.authorizationStatus {
    case .notDetermined: resolve("notDetermined")
    case .denied:        resolve("denied")
    case .approved:      resolve("approved")
    @unknown default:    resolve("notDetermined")
    }
  }

  @objc func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16, *) {
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          resolve("approved")
        } catch {
          reject("AUTH_ERROR", error.localizedDescription, error)
        }
      }
    } else {
      AuthorizationCenter.shared.requestAuthorization { result in
        switch result {
        case .success:  resolve("approved")
        case .failure(let error): reject("AUTH_ERROR", error.localizedDescription, error)
        }
      }
    }
  }

  @objc func presentActivityPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let root = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .first?.windows.first?.rootViewController
      else {
        reject("NO_ROOT_VC", "Could not find root view controller", NSError(domain: "FamilyControls", code: -1))
        return
      }

      var settled = false
      var pickerVC: FamilyActivityPickerHostingController?

      pickerVC = FamilyActivityPickerHostingController(
        selection: self.savedSelection,
        onDone: { [weak self] newSelection in
          guard !settled else { return }
          settled = true
          pickerVC?.dismiss(animated: true) {
            self?.savedSelection = newSelection
            resolve(newSelection.applicationTokens.count)
          }
        },
        onCancel: {
          guard !settled else { return }
          settled = true
          pickerVC?.dismiss(animated: true) {
            reject("CANCELLED", "User cancelled", NSError(domain: "FamilyControls", code: -2))
          }
        }
      )
      pickerVC!.modalPresentationStyle = .formSheet
      root.present(pickerVC!, animated: true)
    }
  }

  @objc func hasSelection(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(!savedSelection.applicationTokens.isEmpty)
  }

  @objc func getBlockedCount(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(savedSelection.applicationTokens.count)
  }

  @objc func blockApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let sel = savedSelection
    guard !sel.applicationTokens.isEmpty || !sel.categoryTokens.isEmpty else {
      resolve(false); return
    }
    if !sel.applicationTokens.isEmpty {
      store.shield.applications = sel.applicationTokens
    }
    if !sel.categoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(sel.categoryTokens)
    }
    resolve(true)
  }

  @objc func unblockApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16, *) {
      store.clearAllSettings()
    }
    // Record completion date so the extension won't re-block if startMonitoring fires mid-day
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    UserDefaults(suiteName: kAppGroup)?.set(f.string(from: Date()), forKey: kCompletionDateKey)
    resolve(true)
  }

  @objc func startMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16, *) {
      let center = DeviceActivityCenter()
      let schedule = DeviceActivitySchedule(
        intervalStart: DateComponents(hour: 0, minute: 0),
        intervalEnd: DateComponents(hour: 23, minute: 59),
        repeats: true
      )
      do {
        try center.startMonitoring(.daily, during: schedule)
        resolve(true)
      } catch {
        reject("MONITOR_ERROR", error.localizedDescription, error)
      }
    } else {
      reject("UNSUPPORTED", "DeviceActivity requires iOS 16+", nil)
    }
  }

  @objc func stopMonitoring(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 16, *) {
      DeviceActivityCenter().stopMonitoring()
    }
    resolve(true)
  }

  @objc func setStudyProgress(
    _ completed: NSInteger,
    target: NSInteger,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let ud = UserDefaults(suiteName: kAppGroup)
    ud?.set(completed, forKey: "loqlearn.lessonsCompleted")
    ud?.set(target, forKey: "loqlearn.lessonsTarget")
    resolve(true)
  }
}

private class FamilyActivityPickerHostingController: UIHostingController<AnyView> {
  init(
    selection: FamilyActivitySelection,
    onDone: @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void
  ) {
    let wrapper = PickerWrapper(selection: selection, onDone: onDone, onCancel: onCancel)
    super.init(rootView: AnyView(wrapper))
  }

  @MainActor required dynamic init?(coder aDecoder: NSCoder) {
    fatalError("init(coder:) not supported")
  }
}

private struct PickerWrapper: View {
  @State var selection: FamilyActivitySelection
  let onDone:   (FamilyActivitySelection) -> Void
  let onCancel: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Select Apps to Block")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { onCancel() }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { onDone(selection) }
              .font(.system(size: 16, weight: .semibold))
          }
        }
    }
  }
}
`;

const FAMILY_CONTROLS_MM = `\
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(FamilyControlsModule, NSObject)

RCT_EXTERN_METHOD(
  getAuthorizationStatus:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  requestAuthorization:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  presentActivityPicker:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  hasSelection:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  getBlockedCount:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  blockApps:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  unblockApps:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  startMonitoring:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  stopMonitoring:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  setStudyProgress:(NSInteger)completed
  target:(NSInteger)target
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
`;

const SCREEN_BLOCKING_SWIFT = `\
import Foundation
import UIKit

@objc(ScreenBlockingModule)
class ScreenBlockingModule: NSObject {

  private var blockingOverlay: UIView?
  private var isBlockingEnabled = false

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func enableScreenBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      NotificationCenter.default.addObserver(
        self,
        selector: #selector(self.screenCaptureDidChange),
        name: UIScreen.capturedDidChangeNotification,
        object: nil
      )
      if UIScreen.main.isCaptured { self.showBlockingOverlay() }
      self.isBlockingEnabled = true
      resolve(true)
    }
  }

  @objc func disableScreenBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      NotificationCenter.default.removeObserver(
        self, name: UIScreen.capturedDidChangeNotification, object: nil
      )
      self.hideBlockingOverlay()
      self.isBlockingEnabled = false
      resolve(true)
    }
  }

  @objc func isScreenBlockingEnabled(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    resolve(isBlockingEnabled)
  }

  @objc private func screenCaptureDidChange() {
    DispatchQueue.main.async {
      UIScreen.main.isCaptured ? self.showBlockingOverlay() : self.hideBlockingOverlay()
    }
  }

  private func showBlockingOverlay() {
    guard let window = UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first?.windows.first(where: { $0.isKeyWindow })
    else { return }

    hideBlockingOverlay()

    let overlay = UIView(frame: window.bounds)
    overlay.backgroundColor = .black
    overlay.tag = 9999
    overlay.isUserInteractionEnabled = false

    let label = UILabel()
    label.text = "\\u{1F512} Screen recording\\nis not allowed"
    label.textColor = .white
    label.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
    label.textAlignment = .center
    label.numberOfLines = 2
    label.translatesAutoresizingMaskIntoConstraints = false
    overlay.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
    ])

    window.addSubview(overlay)
    blockingOverlay = overlay
  }

  private func hideBlockingOverlay() {
    blockingOverlay?.removeFromSuperview()
    blockingOverlay = nil
    UIApplication.shared.connectedScenes
      .compactMap({ $0 as? UIWindowScene })
      .first?.windows.first(where: { $0.isKeyWindow })?
      .viewWithTag(9999)?.removeFromSuperview()
  }
}
`;

const SCREEN_BLOCKING_MM = `\
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ScreenBlockingModule, NSObject)

RCT_EXTERN_METHOD(
  enableScreenBlocking:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  disableScreenBlocking:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  isScreenBlockingEnabled:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
`;

// ─── DeviceActivityMonitor extension source ──────────────────────────────────

const DEVICE_ACTIVITY_MONITOR_SWIFT = `\
import DeviceActivity
import ManagedSettings
import FamilyControls
import Foundation

private let kAppGroup = "${kAppGroup}"
private let kSelectionKey = "loqlearn.familyActivitySelection"
private let kCompletionDateKey = "loqlearn.lessonsCompletedDate"

class UnloqMonitor: DeviceActivityMonitor {

  private let store = ManagedSettingsStore()

  private var savedSelection: FamilyActivitySelection {
    guard let data = UserDefaults(suiteName: kAppGroup)?.data(forKey: kSelectionKey),
          let sel = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return FamilyActivitySelection() }
    return sel
  }

  private var todayString: String {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
  }

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // Skip blocking if user already completed lessons today.
    // This prevents re-blocking when startMonitoring() fires mid-day on an app relaunch.
    let completedDate = UserDefaults(suiteName: kAppGroup)?.string(forKey: kCompletionDateKey) ?? ""
    guard completedDate != todayString else { return }

    let sel = savedSelection
    if !sel.applicationTokens.isEmpty {
      store.shield.applications = sel.applicationTokens
    }
    if !sel.categoryTokens.isEmpty {
      store.shield.applicationCategories = .specific(sel.categoryTokens)
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    // Intentionally do nothing — shields persist until the user completes their lessons.
    // Clearing here would unblock apps at 23:59 regardless of lesson progress.
    // Tomorrow's intervalDidStart re-applies shields for the new day.
  }
}
`;

const MONITOR_EXTENSION_PLIST = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>UnloqMonitor</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.deviceactivity.monitor</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).UnloqMonitor</string>
    </dict>
</dict>
</plist>
`;

const MONITOR_EXTENSION_ENTITLEMENTS = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.family-controls</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${kAppGroup}</string>
    </array>
</dict>
</plist>
`;

// ─── ShieldConfiguration extension source ────────────────────────────────────

const SHIELD_SWIFT = `\
import ManagedSettingsUI
import ManagedSettings
import Foundation
import UIKit

private let kAppGroup = "${kAppGroup}"

class UnloqShieldConfiguration: ShieldConfigurationDataSource {

  private let indigo = UIColor(red: 99/255.0, green: 102/255.0, blue: 241/255.0, alpha: 1)

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    buildShield()
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    buildShield()
  }

  private func buildShield() -> ShieldConfiguration {
    let ud = UserDefaults(suiteName: kAppGroup)
    let completed = ud?.integer(forKey: "loqlearn.lessonsCompleted") ?? 0
    let target    = max(ud?.integer(forKey: "loqlearn.lessonsTarget") ?? 1, 1)

    let quotes = [
      "Champions are made in the moments they want to stop.",
      "Your future self is watching. Don't let them down.",
      "Every lesson is a step closer to who you want to be.",
      "Discipline is choosing what you want most over what you want now.",
      "The apps will be there. Your growth window won't.",
      "Knowledge compounds. Distraction doesn't.",
      "You locked these apps for a reason. Remember why.",
    ]
    let dayOfYear = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 1
    let quote = quotes[(dayOfYear - 1) % quotes.count]

    let progressText = "\\u{1F4DA} \\(completed) of \\(target) lessons done today"

    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterial,
      icon: makeIcon(),
      title: ShieldConfiguration.Label(text: "Focus Mode", color: indigo),
      subtitle: ShieldConfiguration.Label(
        text: "\\(quote)\\n\\n\\(progressText)",
        color: .secondaryLabel
      ),
      primaryButtonLabel: ShieldConfiguration.Label(text: "Close & Study \\u{2192}", color: .white),
      primaryButtonBackgroundColor: indigo
    )
  }

  private func makeIcon() -> UIImage {
    let size = CGSize(width: 60, height: 60)
    return UIGraphicsImageRenderer(size: size).image { _ in
      indigo.withAlphaComponent(0.15).setFill()
      UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 16).fill()
      let cfg = UIImage.SymbolConfiguration(pointSize: 30, weight: .semibold)
      if let img = UIImage(systemName: "lock.fill", withConfiguration: cfg)?
          .withTintColor(indigo, renderingMode: .alwaysOriginal) {
        let s = img.size
        img.draw(in: CGRect(
          x: (size.width - s.width) / 2,
          y: (size.height - s.height) / 2,
          width: s.width, height: s.height
        ))
      }
    }
  }
}
`;

const SHIELD_PLIST = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>UnloqShield</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.managed-settings.shield.configuration</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).UnloqShieldConfiguration</string>
    </dict>
</dict>
</plist>
`;

const SHIELD_ENTITLEMENTS = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${kAppGroup}</string>
    </array>
</dict>
</plist>
`;

// ─── Plugin ──────────────────────────────────────────────────────────────────

/** @type {(config: import('@expo/config-plugins').ExpoConfig) => import('@expo/config-plugins').ExpoConfig} */
const withFamilyControls = (config) => {
  // 1. Main app entitlements: FamilyControls + App Group
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.family-controls'] = true;
    const groups = mod.modResults['com.apple.security.application-groups'];
    if (Array.isArray(groups)) {
      if (!groups.includes(kAppGroup)) groups.push(kAppGroup);
    } else {
      mod.modResults['com.apple.security.application-groups'] = [kAppGroup];
    }
    return mod;
  });

  // 2. Xcode project: main target source files + frameworks, plus extension target
  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectName = mod.modRequest.projectName;
    const mainTarget = project.getFirstTarget();
    const mainTargetUUID = mainTarget.uuid;

    if (!project.hash.project.objects['PBXVariantGroup']) {
      project.hash.project.objects['PBXVariantGroup'] = {};
    }

    // ── Main target: source files ──────────────────────────────────────────
    const pbxGroups = project.hash.project.objects['PBXGroup'] || {};
    let mainGroupKey = null;
    for (const [key, value] of Object.entries(pbxGroups)) {
      if (key.endsWith('_comment')) continue;
      if (typeof value === 'object' && (value.path === projectName || value.name === projectName)) {
        mainGroupKey = key;
        break;
      }
    }

    if (!mainGroupKey) {
      console.warn(`[withFamilyControls] Could not find PBXGroup for "${projectName}" — skipping file addition`);
      return mod;
    }

    const mainSourceFiles = [
      'FamilyControlsModule.swift',
      'FamilyControlsModule.mm',
      'ScreenBlockingModule.swift',
      'ScreenBlockingModule.mm',
    ];

    for (const file of mainSourceFiles) {
      const fullPath = `${projectName}/${file}`;
      if (!project.hasFile(fullPath)) {
        project.addSourceFile(fullPath, { target: mainTargetUUID }, mainGroupKey);
      }
    }

    for (const fw of ['FamilyControls', 'ManagedSettings', 'DeviceActivity']) {
      const fwPath = `System/Library/Frameworks/${fw}.framework`;
      if (!project.hasFile(fwPath)) {
        project.addFramework(fwPath, {
          target: mainTargetUUID,
          sourceTree: 'SDKROOT',
          lastKnownFileType: 'wrapper.framework',
          customFramework: false,
        });
      }
    }

    // ── Extension targets ──────────────────────────────────────────────────
    const nativeTargets = project.hash.project.objects['PBXNativeTarget'] || {};
    const monitorExists = Object.values(nativeTargets).some(
      (t) => t && typeof t === 'object' && t.name === kExtName
    );
    const shieldExists = Object.values(nativeTargets).some(
      (t) => t && typeof t === 'object' && t.name === kShieldExtName
    );

    const u = () => project.generateUuid();
    const objs = project.hash.project.objects;
    const mainTargetObj = objs['PBXNativeTarget'][mainTargetUUID];
    const projectObj = objs['PBXProject'][project.hash.project.rootObject];
    const rootGroupUUID = projectObj.mainGroup;
    const rootGroup = objs['PBXGroup'][rootGroupUUID];

    /** Adds an appex embed build file to the Embed App Extensions copy phase (creates it if missing). */
    function addToEmbedPhase(embedBuildFile, embedPhaseUUID) {
      objs['PBXCopyFilesBuildPhase'] = objs['PBXCopyFilesBuildPhase'] || {};
      let found = false;
      for (const [key, value] of Object.entries(objs['PBXCopyFilesBuildPhase'])) {
        if (key.endsWith('_comment')) continue;
        if (typeof value === 'object' && value.name === '"Embed App Extensions"' && value.dstSubfolderSpec === 13) {
          if (!value.files.includes(embedBuildFile)) value.files.push(embedBuildFile);
          found = true;
          break;
        }
      }
      if (!found) {
        objs['PBXCopyFilesBuildPhase'][embedPhaseUUID] = {
          isa: 'PBXCopyFilesBuildPhase',
          buildActionMask: 2147483647,
          dstPath: '""',
          dstSubfolderSpec: 13,
          files: [embedBuildFile],
          name: '"Embed App Extensions"',
          runOnlyForDeploymentPostprocessing: 0,
        };
        objs['PBXCopyFilesBuildPhase'][`${embedPhaseUUID}_comment`] = 'Embed App Extensions';
        if (mainTargetObj && Array.isArray(mainTargetObj.buildPhases)) {
          mainTargetObj.buildPhases.push(embedPhaseUUID);
        }
      }
    }

    // ── Monitor extension ──────────────────────────────────────────────────
    if (!monitorExists) {
      const swiftFileRef       = u();
      const plistFileRef       = u();
      const entitlementsRef    = u();
      const productRef         = u();
      const daFwRef            = u();
      const msFwRef            = u();
      const fcFwRef            = u();
      const swiftBuildFile     = u();
      const daFwBuildFile      = u();
      const msFwBuildFile      = u();
      const fcFwBuildFile      = u();
      const embedBuildFile     = u();
      const sourcesPhaseUUID   = u();
      const fwPhaseUUID        = u();
      const resourcesPhaseUUID = u();
      const debugConfigUUID    = u();
      const releaseConfigUUID  = u();
      const configListUUID     = u();
      const extTargetUUID      = u();
      const extGroupUUID       = u();
      const containerProxyUUID = u();
      const targetDepUUID      = u();
      const embedPhaseUUID     = u();

      objs['PBXFileReference'] = objs['PBXFileReference'] || {};
      objs['PBXFileReference'][swiftFileRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'sourcecode.swift',
        name: 'UnloqMonitor.swift', path: `${kExtName}/UnloqMonitor.swift`, sourceTree: '"<group>"',
      };
      objs['PBXFileReference'][`${swiftFileRef}_comment`] = 'UnloqMonitor.swift';
      objs['PBXFileReference'][plistFileRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'text.plist.xml',
        name: 'Info.plist', path: `${kExtName}/Info.plist`, sourceTree: '"<group>"',
      };
      objs['PBXFileReference'][`${plistFileRef}_comment`] = 'Info.plist';
      objs['PBXFileReference'][entitlementsRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'text.plist.entitlements',
        name: 'UnloqMonitorExtension.entitlements',
        path: `${kExtName}/UnloqMonitorExtension.entitlements`, sourceTree: '"<group>"',
      };
      objs['PBXFileReference'][`${entitlementsRef}_comment`] = 'UnloqMonitorExtension.entitlements';
      objs['PBXFileReference'][productRef] = {
        isa: 'PBXFileReference', explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0, path: 'UnloqMonitor.appex', sourceTree: 'BUILT_PRODUCTS_DIR',
      };
      objs['PBXFileReference'][`${productRef}_comment`] = 'UnloqMonitor.appex';
      objs['PBXFileReference'][daFwRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework',
        name: 'DeviceActivity.framework',
        path: 'System/Library/Frameworks/DeviceActivity.framework', sourceTree: 'SDKROOT',
      };
      objs['PBXFileReference'][`${daFwRef}_comment`] = 'DeviceActivity.framework';
      objs['PBXFileReference'][msFwRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework',
        name: 'ManagedSettings.framework',
        path: 'System/Library/Frameworks/ManagedSettings.framework', sourceTree: 'SDKROOT',
      };
      objs['PBXFileReference'][`${msFwRef}_comment`] = 'ManagedSettings.framework';
      objs['PBXFileReference'][fcFwRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework',
        name: 'FamilyControls.framework',
        path: 'System/Library/Frameworks/FamilyControls.framework', sourceTree: 'SDKROOT',
      };
      objs['PBXFileReference'][`${fcFwRef}_comment`] = 'FamilyControls.framework';

      objs['PBXBuildFile'] = objs['PBXBuildFile'] || {};
      objs['PBXBuildFile'][swiftBuildFile] = { isa: 'PBXBuildFile', fileRef: swiftFileRef };
      objs['PBXBuildFile'][`${swiftBuildFile}_comment`] = 'UnloqMonitor.swift in Sources';
      objs['PBXBuildFile'][daFwBuildFile] = { isa: 'PBXBuildFile', fileRef: daFwRef };
      objs['PBXBuildFile'][`${daFwBuildFile}_comment`] = 'DeviceActivity.framework in Frameworks';
      objs['PBXBuildFile'][msFwBuildFile] = { isa: 'PBXBuildFile', fileRef: msFwRef };
      objs['PBXBuildFile'][`${msFwBuildFile}_comment`] = 'ManagedSettings.framework in Frameworks';
      objs['PBXBuildFile'][fcFwBuildFile] = { isa: 'PBXBuildFile', fileRef: fcFwRef };
      objs['PBXBuildFile'][`${fcFwBuildFile}_comment`] = 'FamilyControls.framework in Frameworks';
      objs['PBXBuildFile'][embedBuildFile] = {
        isa: 'PBXBuildFile', fileRef: productRef,
        settings: { ATTRIBUTES: ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] },
      };
      objs['PBXBuildFile'][`${embedBuildFile}_comment`] = 'UnloqMonitor.appex in Embed App Extensions';

      objs['PBXSourcesBuildPhase'] = objs['PBXSourcesBuildPhase'] || {};
      objs['PBXSourcesBuildPhase'][sourcesPhaseUUID] = {
        isa: 'PBXSourcesBuildPhase', buildActionMask: 2147483647,
        files: [swiftBuildFile], runOnlyForDeploymentPostprocessing: 0,
      };
      objs['PBXSourcesBuildPhase'][`${sourcesPhaseUUID}_comment`] = 'Sources';

      objs['PBXFrameworksBuildPhase'] = objs['PBXFrameworksBuildPhase'] || {};
      objs['PBXFrameworksBuildPhase'][fwPhaseUUID] = {
        isa: 'PBXFrameworksBuildPhase', buildActionMask: 2147483647,
        files: [daFwBuildFile, msFwBuildFile, fcFwBuildFile], runOnlyForDeploymentPostprocessing: 0,
      };
      objs['PBXFrameworksBuildPhase'][`${fwPhaseUUID}_comment`] = 'Frameworks';

      objs['PBXResourcesBuildPhase'] = objs['PBXResourcesBuildPhase'] || {};
      objs['PBXResourcesBuildPhase'][resourcesPhaseUUID] = {
        isa: 'PBXResourcesBuildPhase', buildActionMask: 2147483647,
        files: [], runOnlyForDeploymentPostprocessing: 0,
      };
      objs['PBXResourcesBuildPhase'][`${resourcesPhaseUUID}_comment`] = 'Resources';

      const monitorBuildSettings = {
        CODE_SIGN_ENTITLEMENTS: `"${kExtName}/UnloqMonitorExtension.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic', CURRENT_PROJECT_VERSION: '1',
        INFOPLIST_FILE: `"${kExtName}/Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: '16.0',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
        PRODUCT_BUNDLE_IDENTIFIER: `"${kExtBundleId}"`,
        PRODUCT_NAME: '"$(TARGET_NAME)"', SKIP_INSTALL: 'YES',
        SWIFT_VERSION: '5.0', TARGETED_DEVICE_FAMILY: '"1,2"',
      };
      objs['XCBuildConfiguration'] = objs['XCBuildConfiguration'] || {};
      objs['XCBuildConfiguration'][debugConfigUUID] = {
        isa: 'XCBuildConfiguration', buildSettings: monitorBuildSettings, name: 'Debug',
      };
      objs['XCBuildConfiguration'][`${debugConfigUUID}_comment`] = 'Debug';
      objs['XCBuildConfiguration'][releaseConfigUUID] = {
        isa: 'XCBuildConfiguration', buildSettings: monitorBuildSettings, name: 'Release',
      };
      objs['XCBuildConfiguration'][`${releaseConfigUUID}_comment`] = 'Release';

      objs['XCConfigurationList'] = objs['XCConfigurationList'] || {};
      objs['XCConfigurationList'][configListUUID] = {
        isa: 'XCConfigurationList',
        buildConfigurations: [debugConfigUUID, releaseConfigUUID],
        defaultConfigurationIsVisible: 0, defaultConfigurationName: 'Release',
      };
      objs['XCConfigurationList'][`${configListUUID}_comment`] =
        `Build configuration list for PBXNativeTarget "${kExtName}"`;

      objs['PBXGroup'][extGroupUUID] = {
        isa: 'PBXGroup', children: [swiftFileRef, plistFileRef, entitlementsRef],
        name: kExtName, sourceTree: '"<group>"',
      };
      objs['PBXGroup'][`${extGroupUUID}_comment`] = kExtName;
      if (rootGroup && Array.isArray(rootGroup.children) && !rootGroup.children.includes(extGroupUUID)) {
        rootGroup.children.push(extGroupUUID);
      }
      for (const [key, value] of Object.entries(objs['PBXGroup'])) {
        if (key.endsWith('_comment')) continue;
        if (typeof value === 'object' && value.name === 'Products') {
          if (Array.isArray(value.children) && !value.children.includes(productRef)) value.children.push(productRef);
          break;
        }
      }

      objs['PBXNativeTarget'] = objs['PBXNativeTarget'] || {};
      objs['PBXNativeTarget'][extTargetUUID] = {
        isa: 'PBXNativeTarget', buildConfigurationList: configListUUID,
        buildPhases: [sourcesPhaseUUID, fwPhaseUUID, resourcesPhaseUUID],
        buildRules: [], dependencies: [], name: kExtName, productName: kExtName,
        productReference: productRef, productType: '"com.apple.product-type.app-extension"',
      };
      objs['PBXNativeTarget'][`${extTargetUUID}_comment`] = kExtName;
      if (Array.isArray(projectObj.targets) && !projectObj.targets.includes(extTargetUUID)) {
        projectObj.targets.push(extTargetUUID);
      }

      objs['PBXContainerItemProxy'] = objs['PBXContainerItemProxy'] || {};
      objs['PBXContainerItemProxy'][containerProxyUUID] = {
        isa: 'PBXContainerItemProxy', containerPortal: project.hash.project.rootObject,
        proxyType: 1, remoteGlobalIDString: extTargetUUID, remoteInfo: `"${kExtName}"`,
      };
      objs['PBXContainerItemProxy'][`${containerProxyUUID}_comment`] = 'PBXContainerItemProxy';
      objs['PBXTargetDependency'] = objs['PBXTargetDependency'] || {};
      objs['PBXTargetDependency'][targetDepUUID] = {
        isa: 'PBXTargetDependency', target: extTargetUUID, targetProxy: containerProxyUUID,
      };
      objs['PBXTargetDependency'][`${targetDepUUID}_comment`] = kExtName;
      if (mainTargetObj && Array.isArray(mainTargetObj.dependencies)) {
        mainTargetObj.dependencies.push(targetDepUUID);
      }

      addToEmbedPhase(embedBuildFile, embedPhaseUUID);
    }

    // ── Shield extension ───────────────────────────────────────────────────
    if (!shieldExists) {
      const shSwiftRef         = u();
      const shPlistRef         = u();
      const shEntRef           = u();
      const shProductRef       = u();
      const shMsuiFwRef        = u();
      const shSwiftBuild       = u();
      const shMsuiFwBuild      = u();
      const shEmbedBuild       = u();
      const shSourcesPhase     = u();
      const shFwPhase          = u();
      const shResourcesPhase   = u();
      const shDebugConfig      = u();
      const shReleaseConfig    = u();
      const shConfigList       = u();
      const shTargetUUID       = u();
      const shGroupUUID        = u();
      const shProxyUUID        = u();
      const shDepUUID          = u();
      const shEmbedPhaseUUID   = u();

      objs['PBXFileReference'] = objs['PBXFileReference'] || {};
      objs['PBXFileReference'][shSwiftRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'sourcecode.swift',
        name: 'UnloqShield.swift', path: `${kShieldExtName}/UnloqShield.swift`, sourceTree: '"<group>"',
      };
      objs['PBXFileReference'][`${shSwiftRef}_comment`] = 'UnloqShield.swift';
      objs['PBXFileReference'][shPlistRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'text.plist.xml',
        name: 'Info.plist', path: `${kShieldExtName}/Info.plist`, sourceTree: '"<group>"',
      };
      objs['PBXFileReference'][`${shPlistRef}_comment`] = 'Info.plist';
      objs['PBXFileReference'][shEntRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'text.plist.entitlements',
        name: 'UnloqShield.entitlements',
        path: `${kShieldExtName}/UnloqShield.entitlements`, sourceTree: '"<group>"',
      };
      objs['PBXFileReference'][`${shEntRef}_comment`] = 'UnloqShield.entitlements';
      objs['PBXFileReference'][shProductRef] = {
        isa: 'PBXFileReference', explicitFileType: '"wrapper.app-extension"',
        includeInIndex: 0, path: 'UnloqShield.appex', sourceTree: 'BUILT_PRODUCTS_DIR',
      };
      objs['PBXFileReference'][`${shProductRef}_comment`] = 'UnloqShield.appex';
      objs['PBXFileReference'][shMsuiFwRef] = {
        isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework',
        name: 'ManagedSettingsUI.framework',
        path: 'System/Library/Frameworks/ManagedSettingsUI.framework', sourceTree: 'SDKROOT',
      };
      objs['PBXFileReference'][`${shMsuiFwRef}_comment`] = 'ManagedSettingsUI.framework';

      objs['PBXBuildFile'] = objs['PBXBuildFile'] || {};
      objs['PBXBuildFile'][shSwiftBuild] = { isa: 'PBXBuildFile', fileRef: shSwiftRef };
      objs['PBXBuildFile'][`${shSwiftBuild}_comment`] = 'UnloqShield.swift in Sources';
      objs['PBXBuildFile'][shMsuiFwBuild] = { isa: 'PBXBuildFile', fileRef: shMsuiFwRef };
      objs['PBXBuildFile'][`${shMsuiFwBuild}_comment`] = 'ManagedSettingsUI.framework in Frameworks';
      objs['PBXBuildFile'][shEmbedBuild] = {
        isa: 'PBXBuildFile', fileRef: shProductRef,
        settings: { ATTRIBUTES: ['CodeSignOnCopy', 'RemoveHeadersOnCopy'] },
      };
      objs['PBXBuildFile'][`${shEmbedBuild}_comment`] = 'UnloqShield.appex in Embed App Extensions';

      objs['PBXSourcesBuildPhase'] = objs['PBXSourcesBuildPhase'] || {};
      objs['PBXSourcesBuildPhase'][shSourcesPhase] = {
        isa: 'PBXSourcesBuildPhase', buildActionMask: 2147483647,
        files: [shSwiftBuild], runOnlyForDeploymentPostprocessing: 0,
      };
      objs['PBXSourcesBuildPhase'][`${shSourcesPhase}_comment`] = 'Sources';

      objs['PBXFrameworksBuildPhase'] = objs['PBXFrameworksBuildPhase'] || {};
      objs['PBXFrameworksBuildPhase'][shFwPhase] = {
        isa: 'PBXFrameworksBuildPhase', buildActionMask: 2147483647,
        files: [shMsuiFwBuild], runOnlyForDeploymentPostprocessing: 0,
      };
      objs['PBXFrameworksBuildPhase'][`${shFwPhase}_comment`] = 'Frameworks';

      objs['PBXResourcesBuildPhase'] = objs['PBXResourcesBuildPhase'] || {};
      objs['PBXResourcesBuildPhase'][shResourcesPhase] = {
        isa: 'PBXResourcesBuildPhase', buildActionMask: 2147483647,
        files: [], runOnlyForDeploymentPostprocessing: 0,
      };
      objs['PBXResourcesBuildPhase'][`${shResourcesPhase}_comment`] = 'Resources';

      const shieldBuildSettings = {
        CODE_SIGN_ENTITLEMENTS: `"${kShieldExtName}/UnloqShield.entitlements"`,
        CODE_SIGN_STYLE: 'Automatic', CURRENT_PROJECT_VERSION: '1',
        INFOPLIST_FILE: `"${kShieldExtName}/Info.plist"`,
        IPHONEOS_DEPLOYMENT_TARGET: '16.0',
        LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
        PRODUCT_BUNDLE_IDENTIFIER: `"${kShieldBundleId}"`,
        PRODUCT_NAME: '"$(TARGET_NAME)"', SKIP_INSTALL: 'YES',
        SWIFT_VERSION: '5.0', TARGETED_DEVICE_FAMILY: '"1,2"',
      };
      objs['XCBuildConfiguration'] = objs['XCBuildConfiguration'] || {};
      objs['XCBuildConfiguration'][shDebugConfig] = {
        isa: 'XCBuildConfiguration', buildSettings: shieldBuildSettings, name: 'Debug',
      };
      objs['XCBuildConfiguration'][`${shDebugConfig}_comment`] = 'Debug';
      objs['XCBuildConfiguration'][shReleaseConfig] = {
        isa: 'XCBuildConfiguration', buildSettings: shieldBuildSettings, name: 'Release',
      };
      objs['XCBuildConfiguration'][`${shReleaseConfig}_comment`] = 'Release';

      objs['XCConfigurationList'] = objs['XCConfigurationList'] || {};
      objs['XCConfigurationList'][shConfigList] = {
        isa: 'XCConfigurationList',
        buildConfigurations: [shDebugConfig, shReleaseConfig],
        defaultConfigurationIsVisible: 0, defaultConfigurationName: 'Release',
      };
      objs['XCConfigurationList'][`${shConfigList}_comment`] =
        `Build configuration list for PBXNativeTarget "${kShieldExtName}"`;

      objs['PBXGroup'][shGroupUUID] = {
        isa: 'PBXGroup', children: [shSwiftRef, shPlistRef, shEntRef],
        name: kShieldExtName, sourceTree: '"<group>"',
      };
      objs['PBXGroup'][`${shGroupUUID}_comment`] = kShieldExtName;
      if (rootGroup && Array.isArray(rootGroup.children) && !rootGroup.children.includes(shGroupUUID)) {
        rootGroup.children.push(shGroupUUID);
      }
      for (const [key, value] of Object.entries(objs['PBXGroup'])) {
        if (key.endsWith('_comment')) continue;
        if (typeof value === 'object' && value.name === 'Products') {
          if (Array.isArray(value.children) && !value.children.includes(shProductRef)) value.children.push(shProductRef);
          break;
        }
      }

      objs['PBXNativeTarget'] = objs['PBXNativeTarget'] || {};
      objs['PBXNativeTarget'][shTargetUUID] = {
        isa: 'PBXNativeTarget', buildConfigurationList: shConfigList,
        buildPhases: [shSourcesPhase, shFwPhase, shResourcesPhase],
        buildRules: [], dependencies: [], name: kShieldExtName, productName: kShieldExtName,
        productReference: shProductRef, productType: '"com.apple.product-type.app-extension"',
      };
      objs['PBXNativeTarget'][`${shTargetUUID}_comment`] = kShieldExtName;
      if (Array.isArray(projectObj.targets) && !projectObj.targets.includes(shTargetUUID)) {
        projectObj.targets.push(shTargetUUID);
      }

      objs['PBXContainerItemProxy'] = objs['PBXContainerItemProxy'] || {};
      objs['PBXContainerItemProxy'][shProxyUUID] = {
        isa: 'PBXContainerItemProxy', containerPortal: project.hash.project.rootObject,
        proxyType: 1, remoteGlobalIDString: shTargetUUID, remoteInfo: `"${kShieldExtName}"`,
      };
      objs['PBXContainerItemProxy'][`${shProxyUUID}_comment`] = 'PBXContainerItemProxy';
      objs['PBXTargetDependency'] = objs['PBXTargetDependency'] || {};
      objs['PBXTargetDependency'][shDepUUID] = {
        isa: 'PBXTargetDependency', target: shTargetUUID, targetProxy: shProxyUUID,
      };
      objs['PBXTargetDependency'][`${shDepUUID}_comment`] = kShieldExtName;
      if (mainTargetObj && Array.isArray(mainTargetObj.dependencies)) {
        mainTargetObj.dependencies.push(shDepUUID);
      }

      addToEmbedPhase(shEmbedBuild, shEmbedPhaseUUID);
    }

    return mod;
  });

  // 3. Write source files to disk + patch bridging header + write extension files
  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const platformRoot = mod.modRequest.platformProjectRoot;
      const projectName = mod.modRequest.projectName;
      const sourceDir = path.join(platformRoot, projectName);

      // Main app modules
      fs.writeFileSync(path.join(sourceDir, 'FamilyControlsModule.swift'), FAMILY_CONTROLS_SWIFT);
      fs.writeFileSync(path.join(sourceDir, 'FamilyControlsModule.mm'), FAMILY_CONTROLS_MM);
      fs.writeFileSync(path.join(sourceDir, 'ScreenBlockingModule.swift'), SCREEN_BLOCKING_SWIFT);
      fs.writeFileSync(path.join(sourceDir, 'ScreenBlockingModule.mm'), SCREEN_BLOCKING_MM);

      // Ensure bridging header imports RCTBridgeModule
      const bridgingHeaderPath = path.join(sourceDir, `${projectName}-Bridging-Header.h`);
      if (fs.existsSync(bridgingHeaderPath)) {
        let content = fs.readFileSync(bridgingHeaderPath, 'utf8');
        if (!content.includes('RCTBridgeModule')) {
          fs.writeFileSync(bridgingHeaderPath, content.trimEnd() + '\n#import <React/RCTBridgeModule.h>\n');
        }
      } else {
        fs.writeFileSync(bridgingHeaderPath, '#import <React/RCTBridgeModule.h>\n');
      }

      // Monitor extension files
      const extDir = path.join(platformRoot, kExtName);
      if (!fs.existsSync(extDir)) fs.mkdirSync(extDir, { recursive: true });
      fs.writeFileSync(path.join(extDir, 'UnloqMonitor.swift'), DEVICE_ACTIVITY_MONITOR_SWIFT);
      fs.writeFileSync(path.join(extDir, 'Info.plist'), MONITOR_EXTENSION_PLIST);
      fs.writeFileSync(path.join(extDir, 'UnloqMonitorExtension.entitlements'), MONITOR_EXTENSION_ENTITLEMENTS);

      // Shield extension files
      const shieldDir = path.join(platformRoot, kShieldExtName);
      if (!fs.existsSync(shieldDir)) fs.mkdirSync(shieldDir, { recursive: true });
      fs.writeFileSync(path.join(shieldDir, 'UnloqShield.swift'), SHIELD_SWIFT);
      fs.writeFileSync(path.join(shieldDir, 'Info.plist'), SHIELD_PLIST);
      fs.writeFileSync(path.join(shieldDir, 'UnloqShield.entitlements'), SHIELD_ENTITLEMENTS);

      return mod;
    },
  ]);

  return config;
};

module.exports = withFamilyControls;
