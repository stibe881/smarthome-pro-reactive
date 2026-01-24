import { Router, Response } from 'express';
import { getSettings, createOrUpdateSettings, deleteSettings } from '../db/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes are protected
router.use(authMiddleware);

// Get user settings
router.get('/', (req: AuthRequest, res: Response) => {
    try {
        const settings = getSettings(req.userId!);

        if (!settings) {
            return res.json({ settings: { ha_url: null, ha_token: null } });
        }

        res.json({ settings: { ha_url: settings.ha_url, ha_token: settings.ha_token } });
    } catch (err) {
        console.error('Get settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user settings
router.put('/', (req: AuthRequest, res: Response) => {
    try {
        const { ha_url, ha_token } = req.body;

        if (!ha_url || !ha_token) {
            return res.status(400).json({ error: 'ha_url and ha_token are required' });
        }

        createOrUpdateSettings(req.userId!, ha_url, ha_token);

        res.json({ message: 'Settings saved successfully' });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user settings
router.delete('/', (req: AuthRequest, res: Response) => {
    try {
        deleteSettings(req.userId!);
        res.json({ message: 'Settings deleted successfully' });
    } catch (err) {
        console.error('Delete settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
