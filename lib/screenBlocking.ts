import { NativeModules } from 'react-native';

const { ScreenBlockingModule } = NativeModules;

interface ScreenBlockingModuleInterface {
  enableScreenBlocking(): Promise<void>;
  disableScreenBlocking(): Promise<void>;
  isScreenBlockingEnabled(): Promise<boolean>;
}

const fallbackModule: ScreenBlockingModuleInterface = {
  enableScreenBlocking: async () => {},
  disableScreenBlocking: async () => {},
  isScreenBlockingEnabled: async () => false,
};

export default (ScreenBlockingModule || fallbackModule) as ScreenBlockingModuleInterface;
