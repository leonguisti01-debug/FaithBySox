import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots {return {rules:[{userAgent:'*',allow:'/',disallow:['/admin','/checkout','/api/']}],sitemap:'https://faithbysox.co.za/sitemap.xml',host:'https://faithbysox.co.za'};}
