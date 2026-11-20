/*
  FILE NOTE
  - Mục đích: Chuẩn hóa ảnh sản phẩm và gắn an toàn vào input[type="file"] hoặc dropzone của Facebook / TikTok (v3.0.0).
  - Kiểm tra input.files TRƯỚC khi bắn sự kiện 'change' để tương thích với React onChange tự reset input.value = ''.
*/

;(() => {
  if (globalThis.__OMNICART_MEDIA_VERSION__ === '3.0.0' && globalThis.OmniCartMedia) {
    return
  }
  globalThis.__OMNICART_MEDIA_VERSION__ = '3.0.0'

  function deepQueryFiles(root) {
    if (globalThis.OmniVision?.queryAllDeep) {
      return globalThis.OmniVision.queryAllDeep(root, 'input[type="file"]')
    }
    return Array.from((root || document).querySelectorAll('input[type="file"]'))
  }

  function isImageAccept(acceptRaw, allowUnspecified = true) {
    const accept = String(acceptRaw || '').toLowerCase().trim()
    if (!accept) return allowUnspecified
    const acceptsImage =
      accept.includes('image') ||
      /\.(?:jpe?g|png|webp|gif|heic|avif|bmp)\b/i.test(accept) ||
      accept === '*/*'
    const isVideoOnly = accept.includes('video') && !acceptsImage
    return acceptsImage && !isVideoOnly
  }

  globalThis.OmniCartMedia = {
    async createProductImageFile(dataUrl, fileName = 'omnicart-product.png') {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        throw new Error('PRODUCT_IMAGE_INVALID')
      }

      const sourceImage = new Image()
      sourceImage.decoding = 'async'
      sourceImage.src = dataUrl

      await new Promise((resolve, reject) => {
        sourceImage.onload = resolve
        sourceImage.onerror = () => reject(new Error('PRODUCT_IMAGE_DECODE_FAILED'))
        if (sourceImage.complete && sourceImage.naturalWidth > 0) resolve()
      })

      if (!sourceImage.naturalWidth || !sourceImage.naturalHeight) {
        throw new Error('PRODUCT_IMAGE_DECODE_FAILED')
      }

      const maxDimension = 2048
      const scale = Math.min(1, maxDimension / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * scale))

      const context = canvas.getContext('2d')
      if (!context) throw new Error('PRODUCT_IMAGE_CANVAS_UNAVAILABLE')

      context.drawImage(sourceImage, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result && result.size > 0) resolve(result)
          else reject(new Error('PRODUCT_IMAGE_CONVERSION_FAILED'))
        }, 'image/png')
      })

      return new File([blob], fileName, { type: 'image/png', lastModified: Date.now() })
    },

    async findImageInput(root = document, timeoutMs = 8000, allowUnspecified = true) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const inputs = deepQueryFiles(root)
        const strictMatch = inputs.find((el) => isImageAccept(el.getAttribute('accept'), false))
        if (strictMatch) return strictMatch
        if (allowUnspecified) {
          const fallbackMatch = inputs.find((el) => isImageAccept(el.getAttribute('accept'), true))
          if (fallbackMatch) return fallbackMatch
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      return null
    },

    attachFile(input, file) {
      if (!input || !file) return false
      try {
        const transfer = new DataTransfer()
        transfer.items.add(file)
        input.files = transfer.files

        const assignedOk = Boolean(input.files && input.files.length >= 1 && input.files[0].name === file.name)
        if (!assignedOk) return false

        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
        input.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
        return true
      } catch (_) {
        return false
      }
    },

    attachViaDrop(dropZoneEl, file) {
      if (!dropZoneEl || !file) return false
      try {
        const transfer = new DataTransfer()
        transfer.items.add(file)
        const opts = { bubbles: true, cancelable: true, composed: true, dataTransfer: transfer }
        dropZoneEl.dispatchEvent(new DragEvent('dragenter', opts))
        dropZoneEl.dispatchEvent(new DragEvent('dragover', opts))
        dropZoneEl.dispatchEvent(new DragEvent('drop', opts))
        return true
      } catch (_) {
        return false
      }
    },

    async waitFor(predicate, timeoutMs = 10000, intervalMs = 280) {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        try {
          if (await predicate()) return true
        } catch (_) {}
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
      return false
    }
  }
})()