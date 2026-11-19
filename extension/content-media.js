/*
  FILE NOTE
  - Mục đích: Chuẩn hóa ảnh sản phẩm và gắn vào ô tải ảnh của Facebook/TikTok.
  - Liên kết trực tiếp: Store-Admin/extension/manifest.json, background.js, content-facebook.js, content-tiktok.js.
  - Vùng ảnh hưởng khi sửa: Cách hai trang mạng xã hội nhận ảnh sản phẩm từ extension.
*/

globalThis.OmniCartMedia = {
  async createProductImageFile(dataUrl) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      throw new Error('PRODUCT_IMAGE_INVALID')
    }

    const sourceImage = new Image()
    sourceImage.src = dataUrl
    await sourceImage.decode()

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
        if (result) resolve(result)
        else reject(new Error('PRODUCT_IMAGE_CONVERSION_FAILED'))
      }, 'image/png')
    })

    return new File([blob], 'omnicart-product.png', { type: 'image/png' })
  },

  async findImageInput(root, timeoutMs = 8000, allowUnspecified = true) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const input = Array.from(root.querySelectorAll('input[type="file"]'))
        .find((candidate) => {
          const accept = (candidate.getAttribute('accept') || '').toLowerCase()
          if (!accept) return allowUnspecified
          return accept.includes('image') || /\.(?:jpe?g|png|webp|gif|heic|avif)/i.test(accept)
        })
      if (input) return input
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    return null
  },

  attachFile(input, file) {
    const transfer = new DataTransfer()
    transfer.items.add(file)
    input.files = transfer.files
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    return input.files.length === 1 && input.files[0].name === file.name
  },

  async waitFor(predicate, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (predicate()) return true
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    return false
  }
}
