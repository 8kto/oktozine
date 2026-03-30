/* eslint-env browser */

/**
 * Wraps H2 elements and their following siblings inside .content into labelled div wrappers.
 * Serialized and evaluated inside a Puppeteer browser context via page.evaluate().
 */
export const wrapContentSections = ({ selector, wrapperClass }: { selector: string; wrapperClass: string }): void => {
  const containers = document.querySelectorAll(selector)

  containers.forEach((container) => {
    const children = Array.from(container.children)
    let currentWrapper: HTMLDivElement | null = null

    children.forEach((el) => {
      if (el.tagName === 'H2') {
        currentWrapper = document.createElement('div')
        currentWrapper.classList.add(wrapperClass, (el as HTMLElement).id)

        el.parentNode!.insertBefore(currentWrapper, el)
        currentWrapper.appendChild(el)

        return
      }

      if (currentWrapper) {
        currentWrapper.appendChild(el)
      }
    })
  })
}
