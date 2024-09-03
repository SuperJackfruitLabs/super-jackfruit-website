import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const NOCODB_API_TOKEN = import.meta.env.NOCODB_API_TOKEN;
  
  try {
    
    const contentType = request.headers.get('content-type');

    let email: string | null = null;

    if (contentType?.includes('application/json')) {
      const text = await request.text();
      try {
        const body = JSON.parse(text);
        email = body.email;
      } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
      }
    } else {
      const body = await request.text();
      try {
        const params = new URLSearchParams(body);
        email = params.get('email');
      } catch (parseError) {
        console.error('Error parsing URL-encoded data:', parseError);
      }
    }

    if (!email) {
      throw new Error('Email is missing from the request');
    }

    const response = await fetch('https://app.nocodb.com/api/v2/tables/mssrwrsf2isy9ux/records', {
      method: 'POST',
      headers: {
        'xc-token': NOCODB_API_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Email: email })
    });

    if (response.ok) {
      return new Response(JSON.stringify({ message: 'Success' }), { status: 200 });
    } else {
      const errorText = await response.text();
      throw new Error(`Failed to add email to waitlist: ${errorText}`);
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ message: 'Error occurred', error: errorMessage }), { status: 400 });
  }
};