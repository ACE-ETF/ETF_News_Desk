import React from 'react';
import {createRoot} from 'react-dom/client';
import NewsDesk from '../app/page';
import RssCollectionPage from '../components/RssCollectionPage';
import '../app/globals.css';
createRoot(document.getElementById('root')!).render(location.pathname.endsWith('/rss.html')?<RssCollectionPage/>:<NewsDesk/>);
