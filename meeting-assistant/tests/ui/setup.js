import { afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'

config.global.stubs.transition = false
config.global.stubs['transition-group'] = false

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

afterEach(() => document.body.replaceChildren())
