export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Get the Gemini API key from environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ 
        error: 'Server configuration error: Gemini API key not set in environment variables.',
        details: 'Contact admin to configure GEMINI_API_KEY'
      });
    }

    // Parse and validate request body
    const { prompt, model = 'gemini-1.5-flash-latest' } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ 
        error: 'Bad request: prompt field is required and must be a non-empty string.' 
      });
    }

    // Construct Gemini API endpoint
    const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta/models';
    const endpoint = `${geminiApiBase}/${model}:generateContent?key=${geminiApiKey}`;

    // Build request payload for Gemini
    const requestPayload = {
      contents: [
        {
          parts: [
            {
              text: prompt.trim()
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 1024,
        topP: 0.95,
        topK: 40
      }
    };

    // Call Gemini API
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    // Handle Gemini API errors
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error(`Gemini API error (${geminiResponse.status}):`, errorText);

      // Return user-friendly error messages
      if (geminiResponse.status === 400) {
        return res.status(400).json({ 
          error: 'Invalid request to Gemini API.',
          details: 'Check the prompt format and try again.'
        });
      }
      if (geminiResponse.status === 401) {
        return res.status(500).json({ 
          error: 'Authentication failed with Gemini API.',
          details: 'Contact admin to verify API key configuration.'
        });
      }
      if (geminiResponse.status === 403) {
        return res.status(403).json({ 
          error: 'Access denied. Gemini API quota may be exceeded.',
          details: 'Try again later or contact admin.'
        });
      }
      if (geminiResponse.status === 429) {
        return res.status(429).json({ 
          error: 'Rate limited. Too many requests to Gemini API.',
          details: 'Please wait before trying again.'
        });
      }

      return res.status(500).json({ 
        error: 'Gemini API request failed.',
        details: `Status ${geminiResponse.status}. Please try again.`
      });
    }

    // Parse Gemini response
    const geminiData = await geminiResponse.json();

    // Extract text from Gemini response
    let responseText = '';
    if (
      geminiData.candidates &&
      geminiData.candidates.length > 0 &&
      geminiData.candidates[0].content &&
      geminiData.candidates[0].content.parts &&
      geminiData.candidates[0].content.parts.length > 0
    ) {
      responseText = geminiData.candidates[0].content.parts[0].text || '';
    }

    if (!responseText) {
      return res.status(500).json({ 
        error: 'Gemini returned an empty response.',
        details: 'The API did not generate content. Try a different prompt.'
      });
    }

    // Return success response to frontend
    return res.status(200).json({
      success: true,
      data: {
        text: responseText,
        model: model,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Handler error:', error.message);

    return res.status(500).json({
      error: 'Internal server error.',
      details: error.message || 'An unexpected error occurred. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
}
