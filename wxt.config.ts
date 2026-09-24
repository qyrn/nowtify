import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  imports: false,
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://nowtify.qyrn.dev',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png'
    },
    action: {
      default_title: '__MSG_extName__'
    },
    permissions: ['notifications', 'storage', 'alarms', 'identity'],
    host_permissions: ['https://api.twitch.tv/*', 'https://id.twitch.tv/*']
  }
})
