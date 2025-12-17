import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monoexpire.app',
  appName: 'MonoExpire',
  webDir: 'dist',
  ios: {
    // 启用持久化存储，防止数据丢失
    limitsNavigationsToAppBoundDomains: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
