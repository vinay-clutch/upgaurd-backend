import {Request , Response} from 'express';
import prisma from '../lib/db';
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';
import { JWTSECRET } from '../lib/config';
dotenv.config();

export const signup = async(req:Request,res:Response)=>{
    try{
        const {username, password, email} = req.body;
        if(!username || !password) {
            res.status(400).json({
                message:"Username and password are required"
            });
            return;
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    ...(email ? [{ email }] : [])
                ]
            }
        });
        
        if (existingUser) {
            if (existingUser.username === username) {
                res.status(400).json({ message: "Username already taken" });
                return;
            }
            if (existingUser.email === email) {
                if (existingUser.google_id) {
                    res.status(400).json({ message: "An account with this email already exists. Please sign in with Google." });
                } else {
                    res.status(400).json({ message: "An account with this email already exists." });
                }
                return;
            }
        }

        const hashpass = await bcrypt.hash(password, 10);
        await prisma.user.create({
            data:{
                username,
                password:hashpass,
                email,
                auth_provider: 'local'
            }
        });
        res.status(200).json({
            message:"user signup done successfully"
        });
    }catch(error){
        res.status(500).json({
            message:"server is down"
        });
    }
}

export const signin = async(req:Request, res:Response) =>{
    try{
        const {username, password} = req.body;
        if(!username || !password){
            res.status(400).json({
                message:"username or password is missing"
            });
            return;
        }

        const user = await prisma.user.findFirst({
            where:{
                username:username
            }
        });

        if(!user){
            res.status(400).json({
                message:"user not found"
            });
            return;
        }

        if (user.google_id && !user.password) {
            res.status(400).json({
                message:"This account was created with Google. Please sign in with Google."
            });
            return;
        }

        const pass = await bcrypt.compare(password,user.password!);
        if(!pass){
            res.status(400).json({
                message:"password is incorrect"
            });
            return;
        }

        const token = jwt.sign({
            sub:user.id,
        }, JWTSECRET);

        res.status(200).json({
            message:"signed in successfully",
            token
        })
    }catch(error){
        res.status(500).json({
            message:"server is down"
        });
    }
}


export const me = async(req:Request , res:Response)=>{
    const user = await prisma.user.findFirst({
        where:{
            id:req.userId!
        },
    })
    if(!user){
        res.status(404).json({
            message:"user not found"
        });
        return;
    }
    res.json({
        id:user?.id,
        username:user?.username,
        email:user?.email,
        name:user?.name,
        picture:user?.picture,
        auth_provider:user?.auth_provider,
        discord_webhook:user?.discord_webhook || null
    })
}
