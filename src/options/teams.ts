import { byId, h } from '../shared/dom'
import { t } from '../shared/i18n'
import { icon } from '../shared/icons'
import { send } from '../shared/messages'
import { teamLabel, type Streamer } from '../shared/streamer'
import { confirmDanger, toast } from '../shared/ui'

const container = byId('teams', HTMLDivElement)

function memberChip(member: Streamer): HTMLElement {
  const remove = h(
    'button',
    { type: 'button', class: 'chip-remove', title: t('deleteTitle'), 'aria-label': t('deleteTitle') },
    [icon('close')]
  )
  remove.addEventListener('click', () => {
    void send('deleteStreamer', { id: member.id }).then(refreshTeams, () => {
      toast(t('deleteErrorGeneric'), 'error')
    })
  })
  return h('li', { class: 'chip' }, [h('span', { class: 'chip-label' }, [member.displayName]), remove])
}

function teamCard(team: string, label: string, members: Streamer[]): HTMLElement {
  const remove = h('button', { type: 'button', class: 'btn btn-small btn-danger-ghost' }, [
    t('deleteTeamButton')
  ])
  remove.addEventListener('click', () => {
    void (async () => {
      const confirmed = await confirmDanger(
        t('deleteTeamButton'),
        t('confirmDeleteTeamText', label),
        t('deleteTitle')
      )
      if (!confirmed) return
      await send('deleteTeam', { team })
      await refreshTeams()
    })().catch(() => {
      toast(t('teamDeleteError'), 'error')
    })
  })
  return h('div', { class: 'team-card' }, [
    h('div', { class: 'team-card-head' }, [
      h('h3', { class: 'team-card-title' }, [
        label,
        h('span', { class: 'team-card-count' }, [String(members.length)])
      ]),
      remove
    ]),
    h('ul', { class: 'chips' }, members.map(memberChip))
  ])
}

export async function refreshTeams(): Promise<void> {
  const streamers = await send('getStreamers', null)
  const teams = new Map<string, { label: string; members: Streamer[] }>()
  for (const streamer of streamers) {
    const label = teamLabel(streamer)
    if (!streamer.team || !label) continue
    const group = teams.get(streamer.team) ?? { label, members: [] }
    group.members.push(streamer)
    teams.set(streamer.team, group)
  }

  if (teams.size === 0) {
    container.replaceChildren(h('p', { class: 'empty' }, [t('noTeamsAdded')]))
    return
  }
  container.replaceChildren(
    ...[...teams]
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([team, group]) =>
        teamCard(
          team,
          group.label,
          group.members.sort((a, b) => a.displayName.localeCompare(b.displayName))
        )
      )
  )
}
