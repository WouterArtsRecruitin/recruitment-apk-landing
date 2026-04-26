// netlify/functions/feedback.js
// APK Rating Feedback - Store to Supabase, fire GA4 + Meta CAPI events

const crypto = require('crypto');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_KEY;
const GA4_API_SECRET = process.env.GA4_API_SECRET;
const GA4_MEASUREMENT_ID = 'G-LKNTCG74ME'; // APK property
const META_PIXEL_ID = process.env.META_PIXEL_ID; // from .env
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { email, rating } = data;

    // Validate inputs
    if (!email || !rating) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing email or rating' })
      };
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Rating must be integer 1-5' })
      };
    }

    // Store in Supabase
    const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/rapport_feedback`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_API_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        rating,
        product: 'recruitment-apk',
        created_at: new Date().toISOString()
      })
    });

    if (!supabaseResponse.ok) {
      console.error('Supabase error:', await supabaseResponse.text());
      // Continue anyway - don't fail if Supabase fails
    }

    // Fire GA4 event
    const ga4Payload = {
      client_id: generateClientId(email),
      events: [{
        name: 'rapport_rating',
        params: {
          value: rating,
          currency: 'EUR',
          product: 'recruitment-apk'
        }
      }]
    };

    const ga4Response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify(ga4Payload)
      }
    );

    if (!ga4Response.ok) {
      console.warn('GA4 event failed:', await ga4Response.text());
    }

    // Fire Meta CAPI event
    const hashedEmail = hashData(email.toLowerCase());
    const metaPayload = {
      data: [{
        event_name: 'Rate',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        user_data: {
          em: hashedEmail,
          client_ip_address: event.headers['x-forwarded-for'] || event.headers['client-ip'],
          client_user_agent: event.headers['user-agent']
        },
        custom_data: {
          value: rating,
          currency: 'EUR'
        },
        event_source_url: event.headers['origin'] || 'https://recruitmentapk.nl'
      }]
    };

    const metaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload)
      }
    );

    if (!metaResponse.ok) {
      console.warn('Meta CAPI event failed:', await metaResponse.text());
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        rating_stored: true
      })
    };

  } catch (error) {
    console.error('Feedback handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// SHA256 hash (required by Meta)
function hashData(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Generate consistent client ID from email
function generateClientId(email) {
  return crypto
    .createHash('md5')
    .update(email + 'recruitment-apk')
    .digest('hex');
}
