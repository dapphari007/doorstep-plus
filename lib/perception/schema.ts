import { z } from 'zod'

// Deliberately has no field for *who* someone is: roles and actions only.
export const ActorSchema = z.object({
  role: z.enum(['delivery_person', 'person', 'child', 'group', 'unclear']),
  action: z.string().max(80),
})

export const PerceptionSchema = z.object({
  category: z.enum(['delivery', 'visitor', 'vehicle', 'animal', 'no_activity', 'other']),
  caption: z.string().max(140),
  details: z.string().max(400),
  actors: z.array(ActorSchema).max(6),
  atDoor: z.boolean().optional(),
  motion: z.enum(['arriving', 'leaving', 'passing', 'staying', 'none']).optional(),
  package: z.object({
    present: z.boolean(),
    action: z.enum(['dropped_off', 'picked_up', 'present', 'none', 'unclear']),
  }),
  vehicle: z.object({
    present: z.boolean(),
    kind: z.string().max(40).optional(),
  }),
  carrierGuess: z.string().max(40).optional(),
  urgency: z.enum(['low', 'normal', 'high']),
  confidence: z.number().min(0).max(1),
})

export type ModelPerception = z.infer<typeof PerceptionSchema>

export interface Perception extends ModelPerception {
  /** Notes about what the safety pass changed, for transparency in the UI. */
  safetyNotes: string[]
  model: string
  latencyMs: number
}
