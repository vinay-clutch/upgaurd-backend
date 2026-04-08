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
        include: {
            _count: {
                select: {
                    websites: true,
                }
            }
        }
    })
    if(!user){
        res.status(404).json({
            message:"user not found"
        });
        return;
    }

    // Get total checks Across all websites
    const totalTicks = await prisma.website_tick.count({
        where: {
            website: {
                user_id: user.id
            }
        }
    });

    res.json({
        id:user?.id,
        username:user?.username,
        email:user?.email,
        name:user?.name,
        picture:user?.picture,
        auth_provider:user?.auth_provider,
        discord_webhook:user?.discord_webhook || null,
        stats: {
            total_websites: user._count.websites,
            total_checks: totalTicks
        }
    })
}

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const { name, email } = req.body;
        const userId = req.userId!;

        await prisma.user.update({
            where: { id: userId },
            data: { name, email }
        });

        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.userId!;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.password) {
            res.status(400).json({ message: "Invalid user or password not set (OAuth user)" });
            return;
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            res.status(400).json({ message: "Incorrect current password" });
            return;
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedNewPassword }
        });

        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const deleteAccount = async (req: Request, res: Response) => {
    try {
        const userId = req.userId!;

        // First delete all ticks associated with user's websites
        const websites = await prisma.website.findMany({ where: { user_id: userId } });
        const websiteIds = websites.map(w => w.id);

        await prisma.website_tick.deleteMany({
            where: { website_id: { in: websiteIds } }
        });

        // Delete websites
        await prisma.website.deleteMany({ where: { user_id: userId } });

        // Finally delete the user
        await prisma.user.delete({ where: { id: userId } });

        res.json({ message: "Account deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
