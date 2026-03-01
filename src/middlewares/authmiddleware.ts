import { Request, Response, NextFunction } from "express";
import { JWTSECRET } from "../lib/config";
import jwt from 'jsonwebtoken'


export const authMiddleware = (req:Request, res:Response, next:NextFunction) =>{
    const authHeader = req.headers.authorization;

    if(!authHeader){
        res.status(401).json({
            message:"Authorization header missing"
        });
        return;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token) {
        res.status(401).json({
            message: "Token missing"
        });
        return;
    }

    try {
        const decoded = jwt.verify(token, JWTSECRET) as {sub:string};
        if(decoded && decoded.sub) {
            req.userId = decoded.sub;
            next();
        } else {
            res.status(401).json({
                message:"Invalid token payload"
            });
        }
    } catch (error) {
        res.status(401).json({
            message:"Invalid or expired token"
        });
    }
}
