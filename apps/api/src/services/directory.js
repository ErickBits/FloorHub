// Lo que un supervisor puede elegir como destino de un comunicado: solo su propio alcance.
export async function getDirectory({ pool }, user) {
  const [campaigns, teams, agents] = await Promise.all([
    pool.query('SELECT id, name FROM campaigns WHERE id = ANY($1) ORDER BY name', [user.campaignIds]),
    pool.query('SELECT id, name, campaign_id FROM teams WHERE id = ANY($1) ORDER BY name', [user.teamIds]),
    pool.query(
      `SELECT id, full_name, team_id FROM users
        WHERE role = 'agent' AND is_active AND team_id = ANY($1)
        ORDER BY full_name`,
      [user.teamIds],
    ),
  ]);
  return { campaigns: campaigns.rows, teams: teams.rows, agents: agents.rows };
}
