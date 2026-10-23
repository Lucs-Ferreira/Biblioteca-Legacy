// api/google-auth.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, refresh_token } = req.body || {};
  const client_id = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;

  if (!client_id || !client_secret) {
    return res.status(500).json({
      error: 'Variáveis VITE_GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET ausentes no painel da Vercel.'
    });
  }

  try {
    // 1. Troca inicial do código OAuth por access_token + refresh_token definitivo
    if (code) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id,
          client_secret,
          redirect_uri: 'postmessage', // Obrigatório para o popup do Google Identity Services (initCodeClient)
          grant_type: 'authorization_code'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Falha ao trocar código por token.');
      }

      return res.status(200).json({
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        expires_in: data.expires_in || 3500
      });
    }

    // 2. Renovação silenciosa em segundo plano (sem abrir janelas para o usuário)
    if (refresh_token) {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token,
          client_id,
          client_secret,
          grant_type: 'refresh_token'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Falha ao renovar access_token.');
      }

      return res.status(200).json({
        access_token: data.access_token,
        expires_in: data.expires_in || 3500
      });
    }

    return res.status(400).json({ error: 'Informe code ou refresh_token.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}