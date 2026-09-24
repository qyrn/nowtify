import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  imports: false,
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwKxpBEdgbZaEFxU2rlh3A6GJovOYMhVjsBqQ495uSMCbN2BjcljdK4xcLgk240z1NanKnLtGodx9PeJ5zV+wMjoHsHtxAiCnPxO3xpR8qAvLynfTfSQtYOmmUjW1GS1kPNOOhAbK2BWFU3ZtnGZtuJPBu6mGLXPd/J0NEa+wWemtU5wbLYILnVZk40vSdr5mz8/CFFJPZ0SyrvQAp8L/EaYVd0iNIOjvtv1u39cSyc+OlA5UrSMQDyQPtOoucRcywW5X5r7TBoPNKmw9dTaiDRcIr7jp+qX4bSJp6CY3h5ufJkMJxBSlTU+murUJzWk1qgq1S55neA3o1Jsz8Pm+fwIDAQAB',
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
