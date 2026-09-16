-- Update event_settings with the official CELSUC 2026 template and event details
UPDATE event_settings
SET
  lieu = 'IUC – Campus de Dschang',
  heure_debut = '17 h 00',
  heure_fin = '07 h 00',
  dress_code = 'Black or White 🖤🤍',
  whatsapp_template_fr = '🎓✨ Bonjour {nom_complet} !

Vous êtes cordialement invité(e) à la grande soirée CELSUC 2026 🥳🎉

📅 Date : {date_evenement}
📍 Lieu : {lieu}
🕕 Heure : {heure_debut}
👔 Dress code : {dress_code}

🙏🏾 Merci de confirmer votre présence avant le {date_limite} via le lien ci-dessous :

🔗 {lien}

✨ Nous avons hâte de vous compter parmi nous ! 🥂🎊',
  whatsapp_template_en = '🎓✨ Hello {nom_complet} !

You are cordially invited to the grand CELSUC 2026 gala evening 🥳🎉

📅 Date: {date_evenement}
📍 Location: {lieu}
🕕 Time: {heure_debut}
👔 Dress code: {dress_code}

🙏🏾 Please confirm your attendance before {date_limite} via the link below:

🔗 {lien}

✨ We look forward to celebrating with you! 🥂🎊'
WHERE id = (SELECT id FROM event_settings LIMIT 1);
