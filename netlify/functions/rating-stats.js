// netlify/functions/rating-stats.js
// APK Rating Statistics - Fetch from Supabase

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_API_KEY = process.env.SUPABASE_KEY;

exports.handler = async (event, context) => {
  // Only allow GET
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'OPTIONS') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
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
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    };
  }

  try {
    // Fetch all APK ratings from Supabase
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rapport_feedback?product=eq.recruitment-apk&select=rating`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      console.error('Supabase fetch error:', await response.text());
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Failed to fetch ratings',
          average: 0,
          total: 0,
          distribution: {}
        })
      };
    }

    const ratings = await response.json();
    const total = ratings.length;

    // Calculate average and distribution
    let sum = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    ratings.forEach(r => {
      const rating = r.rating;
      if (rating >= 1 && rating <= 5) {
        sum += rating;
        distribution[rating]++;
      }
    });

    const average = total > 0 ? sum / total : 0;

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300' // Cache for 5 minutes
      },
      body: JSON.stringify({
        average: parseFloat(average.toFixed(1)),
        total,
        distribution,
        percentage_positive: total > 0 ? Math.round((distribution[4] + distribution[5]) / total * 100) : 0
      })
    };

  } catch (error) {
    console.error('Rating stats handler error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: error.message,
        average: 0,
        total: 0,
        distribution: {}
      })
    };
  }
};
