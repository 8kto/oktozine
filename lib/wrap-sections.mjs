/* eslint-env browser */

export const wrapContentSections = ({ selector, wrapperClass }) => {
  const containers = document.querySelectorAll(selector)

  containers.forEach((container) => {
    const children = Array.from(container.children)
    let currentWrapper = null

    children.forEach((el) => {
      if (el.tagName === 'H2') {
        currentWrapper = document.createElement('div')
        currentWrapper.classList.add(wrapperClass, el.id)

        el.parentNode.insertBefore(currentWrapper, el)
        currentWrapper.appendChild(el)

        return
      }

      if (currentWrapper) {
        currentWrapper.appendChild(el)
      }
    })
  })
}
