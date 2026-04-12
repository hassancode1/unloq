// @ts-check
/**
 * Expo Config Plugin — injects FamilyControls & ScreenBlocking native modules
 * into the iOS project during `expo prebuild` so EAS cloud builds include them.
 */
const { withXcodeProject, withEntitlementsPlist, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

// ─── Swift / ObjC source content ─────────────────────────────────────────────

const FAMILY_CONTROLS_SWIFT = `\
import Foundation
import FamilyControls
import ManagedSettings
import SwiftUI

private let kSelectionKey = "loqlearn.familyActivitySelection"

@objc(FamilyControlsModule)
class FamilyControlsModule: NSObject {

  private lazy var store = ManagedSettingsStore()

  private var savedSelection: FamilyActivitySelection {
    get {
      guard let data = UserDefaults.standard.data(forKey: kSelectionKey),
            let sel = try? PropertyListDecoder().decode(FamilyActivitySelection.self, from: data)
      else { return FamilyActivitySelection() }
      return sel
    }
    set {
      let data = try? PropertyListEncoder().encode(newValue)
      UserDefaults.standard.set(data, forKey: kSelectionKey)
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
    guard !sel.applications.isEmpty else { resolve(false); return }
    store.shield.applications = sel.applicationTokens
    resolve(true)
  }

  @objc func unblockApps(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
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

// ─── Plugin ──────────────────────────────────────────────────────────────────

/** @type {(config: import('@expo/config-plugins').ExpoConfig) => import('@expo/config-plugins').ExpoConfig} */
const withFamilyControls = (config) => {
  // 1. Entitlement
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.developer.family-controls'] = true;
    return mod;
  });

  // 2. Xcode project: add source files + link frameworks
  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const projectName = mod.modRequest.projectName;
    const targetUUID = project.getFirstTarget().uuid;

    // Find the PBXGroup UUID for the main app target (by path or name)
    const pbxGroups = project.hash.project.objects['PBXGroup'] || {};
    let groupKey = null;
    for (const [key, value] of Object.entries(pbxGroups)) {
      if (key.endsWith('_comment')) continue;
      if (typeof value === 'object' && (value.path === projectName || value.name === projectName)) {
        groupKey = key;
        break;
      }
    }

    if (!groupKey) {
      console.warn(`[withFamilyControls] Could not find PBXGroup for "${projectName}" — skipping file addition`);
      return mod;
    }

    const sourceFiles = [
      { file: 'FamilyControlsModule.swift', type: 'sourcecode.swift' },
      { file: 'FamilyControlsModule.mm',    type: 'sourcecode.cpp.objcpp' },
      { file: 'ScreenBlockingModule.swift',  type: 'sourcecode.swift' },
      { file: 'ScreenBlockingModule.mm',     type: 'sourcecode.cpp.objcpp' },
    ];

    for (const { file, type } of sourceFiles) {
      const fullPath = `${projectName}/${file}`;
      if (!project.hasFile(fullPath)) {
        project.addFile(file, groupKey, {
          target: targetUUID,
          lastKnownFileType: type,
          sourceTree: '"<group>"',
        });
      }
    }

    for (const fw of ['FamilyControls', 'ManagedSettings']) {
      const fwPath = `System/Library/Frameworks/${fw}.framework`;
      if (!project.hasFile(fwPath)) {
        project.addFramework(fwPath, {
          target: targetUUID,
          sourceTree: 'SDKROOT',
          lastKnownFileType: 'wrapper.framework',
          customFramework: false,
        });
      }
    }

    return mod;
  });

  // 3. Write source files to disk + patch bridging header
  config = withDangerousMod(config, [
    'ios',
    (mod) => {
      const platformRoot = mod.modRequest.platformProjectRoot;
      const projectName = mod.modRequest.projectName;
      const sourceDir = path.join(platformRoot, projectName);

      fs.writeFileSync(path.join(sourceDir, 'FamilyControlsModule.swift'), FAMILY_CONTROLS_SWIFT);
      fs.writeFileSync(path.join(sourceDir, 'FamilyControlsModule.mm'), FAMILY_CONTROLS_MM);
      fs.writeFileSync(path.join(sourceDir, 'ScreenBlockingModule.swift'), SCREEN_BLOCKING_SWIFT);
      fs.writeFileSync(path.join(sourceDir, 'ScreenBlockingModule.mm'), SCREEN_BLOCKING_MM);

      // Ensure bridging header imports RCTBridgeModule (needed for Swift ↔ ObjC types)
      const bridgingHeaderPath = path.join(sourceDir, `${projectName}-Bridging-Header.h`);
      if (fs.existsSync(bridgingHeaderPath)) {
        let content = fs.readFileSync(bridgingHeaderPath, 'utf8');
        if (!content.includes('RCTBridgeModule')) {
          fs.writeFileSync(bridgingHeaderPath, content.trimEnd() + '\n#import <React/RCTBridgeModule.h>\n');
        }
      } else {
        fs.writeFileSync(bridgingHeaderPath, '#import <React/RCTBridgeModule.h>\n');
      }

      return mod;
    },
  ]);

  return config;
};

module.exports = withFamilyControls;
