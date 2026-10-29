import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
const dep=name=>fileURLToPath(new URL('./node_modules/'+name,import.meta.url));
export default defineConfig({
 root:here,base:'/ETF_News_Desk/',publicDir:'../public',
 plugins:[react()],
 resolve:{alias:{react:dep('react'),'react-dom':dep('react-dom'),'lucide-react':dep('lucide-react')}},
 css:{postcss:{plugins:[]}},
 build:{outDir:'../dist-pages',emptyOutDir:true}
});
