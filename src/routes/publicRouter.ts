import { Router } from 'express';
import * as publicController from '../controllers/publicController';

const router = Router();

router.get('/:username', publicController.getPublicStatus);

export default router;
