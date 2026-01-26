import { useEffect, useState } from 'react';
import { spotifyService } from '../services/spotifyService';

interface SpotifyCallbackProps {
    onComplete: () => void;
}

export default function SpotifyCallback({ onComplete }: SpotifyCallbackProps) {
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const code = params.get('code');
            const errorParam = params.get('error');

            if (errorParam) {
                setStatus('error');
                setError(errorParam);
                return;
            }

            if (!code) {
                setStatus('error');
                setError('Kein Autorisierungscode erhalten');
                return;
            }

            const success = await spotifyService.handleCallback(code);

            if (success) {
                setStatus('success');
                // Clear URL params and redirect
                window.history.replaceState({}, '', window.location.pathname.replace('/spotify-callback', '/'));
                setTimeout(() => {
                    onComplete();
                }, 1500);
            } else {
                setStatus('error');
                setError('Token-Austausch fehlgeschlagen');
            }
        };

        handleCallback();
    }, [onComplete]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        }}>
            {status === 'processing' && (
                <>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        border: '4px solid rgba(30, 215, 96, 0.3)',
                        borderTopColor: '#1ed760',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <h2 style={{ color: '#fff', marginTop: '20px' }}>
                        Verbinde mit Spotify...
                    </h2>
                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </>
            )}

            {status === 'success' && (
                <>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: '#1ed760',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '30px'
                    }}>
                        ✓
                    </div>
                    <h2 style={{ color: '#1ed760', marginTop: '20px' }}>
                        Spotify verbunden!
                    </h2>
                    <p style={{ color: '#aaa' }}>
                        Du wirst weitergeleitet...
                    </p>
                </>
            )}

            {status === 'error' && (
                <>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: '#e74c3c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '30px',
                        color: '#fff'
                    }}>
                        ✕
                    </div>
                    <h2 style={{ color: '#e74c3c', marginTop: '20px' }}>
                        Fehler bei der Verbindung
                    </h2>
                    <p style={{ color: '#aaa' }}>
                        {error}
                    </p>
                    <button
                        onClick={onComplete}
                        style={{
                            marginTop: '20px',
                            padding: '12px 24px',
                            background: '#1ed760',
                            border: 'none',
                            borderRadius: '20px',
                            color: '#000',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Zurück
                    </button>
                </>
            )}
        </div>
    );
}
