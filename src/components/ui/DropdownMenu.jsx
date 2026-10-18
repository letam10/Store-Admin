import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './DropdownMenu.css'

function normalizeOption(option) {
  if (Array.isArray(option)) return { value: option[0], label: option[1] }
  if (option && typeof option === 'object') return option
  return { value: option, label: String(option ?? '') }
}

function sameValue(left, right) {
  return left === right || String(left) === String(right)
}

function dispatchDropdownEvent(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  const event = typeof window.CustomEvent === 'function'
    ? new window.CustomEvent(name, { detail })
    : new window.Event(name)
  if (!('detail' in event)) event.detail = detail
  window.dispatchEvent(event)
}

export default function DropdownMenu({ value, options = [], onChange, ariaLabel, disabled = false, className = '' }) {
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options])
  const selectedIndex = normalizedOptions.findIndex((option) => sameValue(option.value, value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const listId = useId()

  useEffect(() => {
    const closeWhenAnotherOpens = (event) => {
      if (event.detail !== rootRef.current) setOpen(false)
    }
    const closeFromParent = () => setOpen(false)
    window.addEventListener('admin:dropdown-open', closeWhenAnotherOpens)
    window.addEventListener('admin:dropdown-close', closeFromParent)
    return () => {
      window.removeEventListener('admin:dropdown-open', closeWhenAnotherOpens)
      window.removeEventListener('admin:dropdown-close', closeFromParent)
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const measureViewport = () => {
      const trigger = triggerRef.current
      const root = rootRef.current
      if (!trigger || !root) return
      const rect = trigger.getBoundingClientRect()
      root.style.setProperty('--admin-dropdown-max-height', `${Math.max(140, Math.min(360, window.innerHeight - rect.bottom - 12))}px`)
    }
    measureViewport()
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    window.addEventListener('resize', measureViewport)
    window.addEventListener('scroll', measureViewport, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      window.removeEventListener('resize', measureViewport)
      window.removeEventListener('scroll', measureViewport, true)
    }
  }, [open])

  const firstEnabledIndex = normalizedOptions.findIndex((option) => !option.disabled)
  const selectedOption = normalizedOptions[selectedIndex]
  const activeOption = normalizedOptions[activeIndex]
  const triggerLabel = selectedOption?.label ?? normalizedOptions[firstEnabledIndex]?.label ?? ''

  function openMenu() {
    if (disabled) return
    setActiveIndex(selectedIndex >= 0 && !normalizedOptions[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex)
    dispatchDropdownEvent('admin:dropdown-open', rootRef.current)
    setOpen(true)
  }

  function closeMenu(restoreFocus = true) {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  function selectOption(index) {
    const option = normalizedOptions[index]
    if (!option || option.disabled) return
    onChange?.(option.value)
    closeMenu()
  }

  function moveActive(step) {
    if (!normalizedOptions.length) return
    let nextIndex = activeIndex >= 0 ? activeIndex : (step > 0 ? -1 : normalizedOptions.length)
    for (let count = 0; count < normalizedOptions.length; count += 1) {
      nextIndex = (nextIndex + step + normalizedOptions.length) % normalizedOptions.length
      if (!normalizedOptions[nextIndex].disabled) {
        setActiveIndex(nextIndex)
        return
      }
    }
  }

  function handleTriggerKeyDown(event) {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) selectOption(activeIndex)
      else openMenu()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openMenu()
        return
      }
      moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open) return
      event.preventDefault()
      const step = event.key === 'Home' ? 1 : -1
      let index = event.key === 'Home' ? -1 : normalizedOptions.length
      for (let count = 0; count < normalizedOptions.length; count += 1) {
        index += step
        if (!normalizedOptions[index]?.disabled) {
          setActiveIndex(index)
          return
        }
      }
      return
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      closeMenu()
    }
  }

  const classes = ['admin-dropdown-menu', open ? 'is-open' : '', disabled ? 'is-disabled' : '', className].filter(Boolean).join(' ')
  return <div ref={rootRef} className={classes}>
    <button
      ref={triggerRef}
      className="admin-dropdown-menu__trigger"
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-controls={listId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-activedescendant={open && activeOption ? `${listId}-${activeIndex}` : undefined}
      disabled={disabled}
      onClick={() => (open ? closeMenu() : openMenu())}
      onKeyDown={handleTriggerKeyDown}
    >
      <span className="admin-dropdown-menu__value">{triggerLabel}</span>
      <span className="admin-dropdown-menu__caret" aria-hidden="true">⌄</span>
    </button>
    {open && <ul id={listId} className="admin-dropdown-menu__panel" role="listbox" aria-label={ariaLabel}>
      {normalizedOptions.map((option, index) => <li
        key={`${String(option.value)}-${index}`}
        id={`${listId}-${index}`}
        className={'admin-dropdown-menu__option' + (index === activeIndex ? ' is-active' : '')}
        role="option"
        aria-selected={index === selectedIndex}
        aria-disabled={option.disabled || undefined}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => { if (!option.disabled) setActiveIndex(index) }}
        onClick={() => selectOption(index)}
      >
        <span>{option.label}</span>
        {index === selectedIndex && <span aria-hidden="true">✓</span>}
      </li>)}
    </ul>}
  </div>
}
