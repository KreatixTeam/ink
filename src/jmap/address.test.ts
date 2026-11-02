import { describe, expect, it } from 'vitest'
import { displayName, formatAddress, parseAddressList } from './address'

describe('address helpers', () => {
  it('parses angle addresses, bare addresses, quoted commas, semicolons, and empties', () => {
    expect(parseAddressList(
      'A <a@x.dev>, "Doe, J" <j@x>; b@y.dev,,  ',
    )).toEqual([
      { name: 'A', email: 'a@x.dev' },
      { name: 'Doe, J', email: 'j@x' },
      { name: null, email: 'b@y.dev' },
    ])
  })

  it('formats addresses and falls back to the email local-part', () => {
    expect(formatAddress({ name: 'Doe, J', email: 'j@x' })).toBe('"Doe, J" <j@x>')
    expect(displayName({ name: null, email: 'jane@example.test' })).toBe('jane')
  })
})
