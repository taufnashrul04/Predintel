import { VENUE_MAP } from '../venues.mjs'

export function validateSuiExecution(venueId) {
  const venue = VENUE_MAP.get(venueId)
  if (!venue) {
    throw new Error(`Venue '${venueId}' is not recognized.`)
  }
  if (venue.chain !== 'Sui') {
    throw new Error(`Autonomous Agent execution (x402) is only enabled for Sui venues (WaterX, DeepBook). Venue '${venue.name}' operates on ${venue.chain}.`)
  }
  return venue
}
