export default class Debug {
  static clear () {
    if (typeof document === 'undefined') {
      return
    }

    document.getElementById('debug').innerHTML = ''
  }

  static log (message) {
    if (typeof document === 'undefined') {
      return
    }

    const element = document.getElementById('debug')
    if (element) {
      const div = document.createElement('div')
      const text = document.createTextNode(message)
      div.appendChild(text)

      element.appendChild(div)
      while (element.scrollHeight > element.clientHeight) {
        element.removeChild(element.firstChild)
      }
    }
  }
}
