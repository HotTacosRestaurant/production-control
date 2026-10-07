import type {Metadata} from 'next';

export const metadata:Metadata={
 title:'Management Information | Production Control',
 description:'Production Control KPI dashboard',
 applicationName:'Production Control Management Information',
 robots:{index:false,follow:false},
};

export default function ShowcaseLayout({children}:{children:React.ReactNode}){return children;}
