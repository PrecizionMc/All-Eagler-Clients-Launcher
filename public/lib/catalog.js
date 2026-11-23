export function uniqueClients(clients) {
  return [...new Map(clients.filter(client => client.available).map(client => [client.id, client])).values()];
}

export function filterClients(clients, { query = '', version = '', type = '', savedOnly = false, saved = new Set() } = {}) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return clients.filter(client => (
    (!version || client.version === version)
    && (!type || client.type === type)
    && (!savedOnly || saved.has(client.id))
    && words.every(word => `${client.name} ${client.version} ${client.runtime} ${client.type}`.toLowerCase().includes(word))
  ));
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : 1;
  return `${(bytes / 1024 ** unit).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}
