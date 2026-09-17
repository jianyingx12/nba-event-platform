import { z } from 'zod';

import { identifierSchema } from './common.js';
import { playerSchema } from './player.js';
import { teamSchema } from './team.js';

export const gameRosterSchema = z
  .object({
    gameId: identifierSchema,
    teams: z.array(teamSchema).length(2),
    players: z.array(playerSchema),
  })
  .strict()
  .superRefine((roster, context) => {
    const teamIds = new Set(roster.teams.map((team) => team.teamId));
    if (teamIds.size !== roster.teams.length) {
      context.addIssue({
        code: 'custom',
        path: ['teams'],
        message: 'teams must be unique',
      });
    }

    const playerIds = new Set<string>();
    roster.players.forEach((player, index) => {
      if (playerIds.has(player.playerId)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'playerId'],
          message: 'players must be unique',
        });
      }
      playerIds.add(player.playerId);

      if (player.teamId && !teamIds.has(player.teamId)) {
        context.addIssue({
          code: 'custom',
          path: ['players', index, 'teamId'],
          message: 'player team must belong to the game',
        });
      }
    });
  });

export type GameRoster = z.infer<typeof gameRosterSchema>;
