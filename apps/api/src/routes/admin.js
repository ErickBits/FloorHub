import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/auth.js';
import { createCampaign, listCampaigns, updateCampaign } from '../services/campaigns.js';
import { createTeam, listTeams, setTeamSupervisors, updateTeam } from '../services/teams.js';
import { createUser, listUsers, updateUser } from '../services/users.js';
import { email, password, shortText, uuidParam } from '../validation.js';

const campaignCreate = z.object({ name: shortText(120) });
const campaignUpdate = z.object({ name: shortText(120).optional(), isActive: z.boolean().optional() });
const teamCreate = z.object({ campaignId: z.uuid(), name: shortText(120) });
const teamUpdate = z.object({ name: shortText(120).optional(), isActive: z.boolean().optional() });
const supervisorsUpdate = z.object({ userIds: z.array(z.uuid()).max(50) });
const userCreate = z.object({
  email,
  password,
  fullName: shortText(120),
  role: z.enum(['agent', 'supervisor', 'admin']),
  teamId: z.uuid().nullable().optional(),
});
const userUpdate = z.object({
  fullName: shortText(120).optional(),
  role: z.enum(['agent', 'supervisor', 'admin']).optional(),
  teamId: z.uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: password.optional(),
});

export function adminRoutes(context) {
  const router = Router();
  router.use(requireRole('admin'));

  router.get('/campaigns', async (_req, res) => {
    res.json({ campaigns: await listCampaigns(context) });
  });

  router.post('/campaigns', async (req, res) => {
    const campaign = await createCampaign(context, campaignCreate.parse(req.body));
    res.status(201).json({ campaign });
  });

  router.patch('/campaigns/:id', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json({ campaign: await updateCampaign(context, id, campaignUpdate.parse(req.body)) });
  });

  router.get('/teams', async (_req, res) => {
    res.json({ teams: await listTeams(context) });
  });

  router.post('/teams', async (req, res) => {
    const team = await createTeam(context, teamCreate.parse(req.body));
    res.status(201).json({ team });
  });

  router.patch('/teams/:id', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json({ team: await updateTeam(context, id, teamUpdate.parse(req.body)) });
  });

  router.put('/teams/:id/supervisors', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    const { userIds } = supervisorsUpdate.parse(req.body);
    await setTeamSupervisors(context, id, userIds);
    res.json({ teamId: id, userIds });
  });

  router.get('/users', async (_req, res) => {
    res.json({ users: await listUsers(context) });
  });

  router.post('/users', async (req, res) => {
    const user = await createUser(context, userCreate.parse(req.body));
    res.status(201).json({ user });
  });

  router.patch('/users/:id', async (req, res) => {
    const { id } = uuidParam.parse(req.params);
    res.json({ user: await updateUser(context, id, userUpdate.parse(req.body)) });
  });

  return router;
}
