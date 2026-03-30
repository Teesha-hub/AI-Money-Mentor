export default async function handler(req, res) {
  const maskKey = (key) => {
    if (!key || typeof key !== 'string') {
      return 'MISSING';
    }
    const trimmed = key.trim();
    if (trimmed.length <= 8) {
      return `${trimmed.slice(0, 2)}***`;
    }
    return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
  };

  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log('[generate] Rejected non-POST method:', req.method);
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Get the Gemini API key from environment variables
    const geminiApiKey = process.env.GEMINI_API_KEY
      || process.env.GEMINI_API
      || process.env.GEMINI_APIKEY
      || '';

    // Safe diagnostics in Vercel logs (masked key only)
    console.log('[generate] KEY (masked):', maskKey(geminiApiKey));
    console.log('[generate] KEY present:', Boolean(geminiApiKey));

    if (!geminiApiKey) {
      return res.status(500).json({ 
        error: 'Server configuration error: Gemini API key not set in environment variables.',
        details: 'Set GEMINI_API_KEY in Vercel project environment variables.'
      });
    }

    // Parse and validate request body
    const { prompt, model } = req.body;
    console.log('[generate] Request body present:', Boolean(req.body));
    console.log('[generate] Prompt length:', typeof prompt === 'string' ? prompt.trim().length : 0);

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
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    const requestedModel = typeof model === 'string' ? model.trim() : '';

    // Discover models supported by this key/account first.
    let discoveredModel = '';
    try {
      const listEndpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
      const listResponse = await fetch(listEndpoint);
      console.log('[generate] ListModels status:', listResponse.status);
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
        console.log('[generate] Discovered model:', discoveredModel || 'none');
      }
    } catch (discoveryError) {
      // Ignore discovery errors and continue with fallback candidates.
      console.error('[generate] Model discovery failed:', discoveryError?.message || discoveryError);
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
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40
      }
    };

    const geminiApiBase = 'https://generativelanguage.googleapis.com/v1beta/models';
    const modelErrors = [];
    let responseText = '';
    let resolvedModel = requestedModel || fallbackModels[0];

    console.log('[generate] Models to try:', modelsToTry.join(', '));

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
        console.error(`[generate] Model ${candidateModel} failed with ${geminiResponse.status}:`, details);
        console.error('Gemini full error:', rawText);

        if (geminiResponse.status === 404) {
          modelErrors.push(`${candidateModel}: unavailable`);
          continue;
        }

        return res.status(500).json({
          success: false,
          error: 'AI generation failed',
          details
        });
      }

      let text = geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .join(' ') || '';
      text = text.trim();

      if (!text) {
        modelErrors.push(`${candidateModel}: empty response`);
        continue;
      }

      responseText = text;
      resolvedModel = candidateModel;
      console.log('[generate] Success model:', resolvedModel);
      break;
    }

    if (!responseText) {
      return res.status(500).json({
        success: false,
        error: 'AI generation failed',
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
      success: false,
      error: 'AI generation failed',
      details: error.message || 'An unexpected error occurred. Please try again later.',
      timestamp: new Date().toISOString()
    });
  }
}
