const STORAGE_KEY = 'nowtify-lang'
const strings = JSON.parse(document.getElementById('strings').textContent)

function storedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function rememberLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    return
  }
}

function detectLanguage() {
  const stored = storedLanguage()
  if (stored === 'en' || stored === 'fr') return stored
  const primary = (navigator.languages && navigator.languages[0]) || navigator.language || 'en'
  return primary.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

function applyLanguage(language) {
  const dictionary = strings[language]
  document.documentElement.lang = language
  document.title = dictionary['meta.title']
  document.querySelector('meta[name="description"]').setAttribute('content', dictionary['meta.description'])
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const text = dictionary[element.dataset.i18n]
    if (text !== undefined) element.textContent = text
  })
  document.querySelectorAll('[data-i18n-alt]').forEach((element) => {
    const text = dictionary[element.dataset.i18nAlt]
    if (text !== undefined) element.alt = text
  })
  document.querySelectorAll('[data-i18n-label]').forEach((element) => {
    const text = dictionary[element.dataset.i18nLabel]
    if (text !== undefined) element.setAttribute('aria-label', text)
  })
  document.querySelectorAll('[data-src-fr]').forEach((element) => {
    element.dataset.srcEn ??= element.getAttribute('src')
    const source = language === 'fr' ? element.dataset.srcFr : element.dataset.srcEn
    if (element.getAttribute('src') !== source) element.setAttribute('src', source)
  })
  document.querySelectorAll('[data-poster-fr]').forEach((video) => {
    video.dataset.posterEn ??= video.getAttribute('poster')
    video.setAttribute('poster', language === 'fr' ? video.dataset.posterFr : video.dataset.posterEn)
  })
  const switcher = document.querySelector('.lang-switch')
  if (switcher) {
    switcher.textContent = language === 'fr' ? 'EN' : 'FR'
    switcher.setAttribute('aria-label', dictionary['lang.switch'])
  }
}

function setupPlayer(player) {
  const video = player.querySelector('video')
  const button = player.querySelector('.play')
  button.addEventListener('click', () => {
    video.controls = true
    player.classList.add('playing')
    video.play().catch(() => {
      video.controls = false
      player.classList.remove('playing')
    })
  })
  video.addEventListener('emptied', () => {
    video.controls = false
    player.classList.remove('playing')
  })
}

document.querySelectorAll('.player').forEach(setupPlayer)

let current = detectLanguage()
applyLanguage(current)

document.querySelector('.lang-switch')?.addEventListener('click', () => {
  current = current === 'fr' ? 'en' : 'fr'
  rememberLanguage(current)
  applyLanguage(current)
})
