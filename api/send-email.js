export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Get EmailJS credentials from environment variables
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY
      || process.env.EMAILJS_ACCESS_TOKEN
      || process.env.EMAILJS_PRIVATE_API_KEY
      || '';

    if (!serviceId || !templateId || !publicKey) {
      return res.status(500).json({
        error: 'Server configuration error: EmailJS credentials not set in environment variables.',
        details: 'Contact admin to configure EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY.'
      });
    }

    // Many EmailJS accounts enforce strict mode for API usage.
    if (!privateKey) {
      return res.status(500).json({
        error: 'Server configuration error: EmailJS private key is missing.',
        details: 'API access is in strict mode. Set EMAILJS_PRIVATE_KEY (or EMAILJS_ACCESS_TOKEN) in Vercel environment variables.'
      });
    }

    // Parse and validate request body
    const {
      recipientName,
      recipientEmail,
      score,
      personality,
      description,
      problems,
      improvements,
      detailedAdvice,
      futureSummary,
      currentSavings,
      improvedSavings,
      week1,
      week2,
      week3,
      week4
    } = req.body;

    // Validate required fields
    if (!recipientName || typeof recipientName !== 'string' || recipientName.trim() === '') {
      return res.status(400).json({ error: 'recipientName is required and must be a non-empty string.' });
    }

    if (!recipientEmail || typeof recipientEmail !== 'string' || recipientEmail.trim() === '') {
      return res.status(400).json({ error: 'recipientEmail is required and must be a non-empty string.' });
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return res.status(400).json({ error: 'recipientEmail must be a valid email address.' });
    }

    // Construct EmailJS API endpoint
    const emailjsApiUrl = 'https://api.emailjs.com/api/v1.0/email/send';

    // Build template parameters (all recipient variable aliases for robustness)
    const templateParams = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      // Optional server-side private key for stricter EmailJS auth.
      accessToken: privateKey,
      template_params: {
        // Recipient field aliases
        name: recipientName,
        from_name: recipientName,
        user_name: recipientName,
        to_name: recipientName,
        email: recipientEmail,
        toEmail: recipientEmail,
        to_email: recipientEmail,
        recipient_email: recipientEmail,
        user_email: recipientEmail,
        reply_to: recipientEmail,
        // Report data
        score: score || 0,
        personality: personality || 'Beginner',
        description: description || 'Complete your assessment to get detailed insights.',
        problems: problems || '',
        improvements: improvements || '',
        ai_advice: detailedAdvice || 'Follow the improvement steps for steady progress.',
        future_summary: futureSummary || 'Your financial future depends on your actions today.',
        current_savings: currentSavings || 0,
        improved_savings: improvedSavings || 0,
        week1: week1 || 'Track your spending patterns.',
        week2: week2 || 'Automate your savings.',
        week3: week3 || 'Build your emergency fund.',
        week4: week4 || 'Start investing wisely.'
      }
    };

    // Call EmailJS API
    const emailResponse = await fetch(emailjsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateParams)
    });

    // Handle EmailJS API errors
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`EmailJS API error (${emailResponse.status}):`, errorText);

      let providerDetails = errorText;
      try {
        const parsed = errorText ? JSON.parse(errorText) : null;
        providerDetails = parsed?.message || parsed?.error || parsed?.detail || errorText;
      } catch (parseError) {
        providerDetails = errorText;
      }

      if (emailResponse.status === 400) {
        return res.status(400).json({
          error: 'Invalid request to EmailJS API.',
          details: providerDetails || 'Check template parameters and try again.'
        });
      }

      if (emailResponse.status === 401) {
        return res.status(500).json({
          error: 'Authentication failed with EmailJS API.',
          details: providerDetails || 'Verify EMAILJS_PUBLIC_KEY (and EMAILJS_PRIVATE_KEY if used).'
        });
      }

      if (emailResponse.status === 403) {
        return res.status(403).json({
          error: 'EmailJS rejected this request (403).',
          details: providerDetails || 'Check service/template/public key mapping and EmailJS account restrictions.'
        });
      }

      if (emailResponse.status === 429) {
        return res.status(429).json({
          error: 'Rate limited. Too many email requests.',
          details: 'Please wait before trying again.'
        });
      }

      return res.status(500).json({
        error: 'Failed to send email via EmailJS.',
        details: providerDetails || `Status ${emailResponse.status}. Please try again later.`
      });
    }

    const rawSuccessBody = await emailResponse.text();
    let emailData = null;
    try {
      emailData = rawSuccessBody ? JSON.parse(rawSuccessBody) : null;
    } catch (parseError) {
      // EmailJS commonly returns plain text "OK" for successful sends.
      emailData = null;
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: 'Email sent successfully!',
      data: {
        recipientEmail,
        providerResponse: emailData || rawSuccessBody || 'OK',
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
