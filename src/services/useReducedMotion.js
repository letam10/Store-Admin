/**
  FILE NOTE
  - Mục đích: Hook chuẩn kiểm tra tùy chọn giảm chuyển động (prefers-reduced-motion) của người dùng.
  - Tương thích: React 19, an toàn khi SSR / test không có window, tự động dọn dẹp listener khi unmount.
*/
import { useEffect, useState } from 'react'

export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (event) => setPrefersReduced(event.matches)

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return prefersReduced
}
