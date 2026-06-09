import React from 'react';
import './layout.css';
import Sidebar from './Sidebar';
import SectorDetailPanel from './SectorDetailPanel';
import MobileTopBar from './MobileTopBar';
import MobileMenu from './MobileMenu';

interface LayoutProps {
    children: React.ReactNode;
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="layout">
            <main className="layout-main">
                <Sidebar />
                {children}
                <SectorDetailPanel />
                <MobileTopBar />
                <MobileMenu />
            </main>
        </div>
    );
};

export default AppLayout;
