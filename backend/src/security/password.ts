import { scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import argon2 from "argon2";
const scrypt=promisify(scryptCallback);
export async function hashPassword(password:string){return argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});}
export async function verifyPassword(password:string,stored:string){if(stored.startsWith("$argon2id$"))return argon2.verify(stored,password);const [algorithm,salt,digest]=stored.split(":");if(algorithm!=="scrypt"||!salt||!digest)return false;const key=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(digest,"hex");return key.length===expected.length&&timingSafeEqual(key,expected);}
