export default function authHeaders() {
  const token = localStorage.getItem("btb_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
