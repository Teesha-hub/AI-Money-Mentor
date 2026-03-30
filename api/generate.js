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
    const { prompt, model } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return res.status(400).json({ 
        error: 'Bad request: prompt field is required and must be a non-empty string.' 
      });
    }

    const fallbackModels = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash',
      'gemini-pro'
    ];

    const requestedModel = typeof model === 'string' ? model.trim() : '';

    // Discover models supported by this key/account first.
    let discoveredModel = '';
    try {
      const listEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
      const listResponse = await fetch(listEndpoint);
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const models = Array.isArray(listData.models) ? listData.models : [];
        const generateModels = models.filter((m) =>
          Array.isArray(m.supportedGenerationMethods)
          && m.supportedGenerationMethods.includes('generateContent')
        );

        const names = generateModels
          .map((m) => String(m.name || '').replace(/^models\//, ''))
          .filter(Boolean);

        discoveredModel = names.find((name) => /flash/i.test(name)) || names[0] || '';
      }
    } catch (discoveryError) {
      // Ignore discovery errors and continue with fallback candidates.
      discoveredModel = '';
    }

    const modelsToTry = [
      requestedModel,
      discoveredModel,
      ...fallbackModels
    ].filter((candidate, idx, arr) => candidate && arr.indexOf(candidate) === idx);

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

    const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta/models';
    const modelErrors = [];
    let responseText = '';
    let resolvedModel = requestedModel || fallbackModels[0];

    for (const candidateModel of modelsToTry) {
      const endpoint = `${geminiApiBase}/${candidateModel}:generateContent?key=${geminiApiKey}`;
      const geminiResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });

      const rawText = await geminiResponse.text();
      let geminiData = null;
      try {
        geminiData = rawText ? JSON.parse(rawText) : null;
      } catch (parseError) {
        geminiData = null;
      }

      if (!geminiResponse.ok) {
        const details = geminiData?.error?.message || rawText || `Status ${geminiResponse.status}`;

        if (geminiResponse.status === 404) {
          modelErrors.push(`${candidateModel}: unavailable`);
          continue;
        }

        console.error(`Gemini API error (${geminiResponse.status}) on model ${candidateModel}:`, details);

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
          details
        });
      }

      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        modelErrors.push(`${candidateModel}: empty response`);
        continue;
      }

      responseText = text;
      resolvedModel = candidateModel;
      break;
    }

    if (!responseText) {
      return res.status(500).json({
        error: 'Gemini API request failed.',
        details: `No working Gemini model found. ${modelErrors.join(' | ') || 'Try again later.'}`
      });
    }

    // Return success response to frontend
    return res.status(200).json({
      success: true,
      data: {
        text: responseText,
        model: resolvedModel,
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
