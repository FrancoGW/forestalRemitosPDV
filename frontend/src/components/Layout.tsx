import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  AppShell, Group, Text, NavLink, Avatar,
  Menu, Burger, ScrollArea, Box, Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconGauge, IconBuilding, IconReceipt2, IconQrcode,
  IconLogout, IconLeaf, IconChevronDown, IconShieldCheck,
} from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface Props {
  navItems: NavItem[];
  basePath: string;
}

export default function Layout({ navItems, basePath }: Props) {
  const [opened, { toggle }] = useDisclosure();
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const rolLabel = usuario?.rol === 'superadmin'
    ? 'Super Admin'
    : `PDV ${usuario?.pdv_numero}`;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="xl"
      styles={{
        header: {
          borderBottom: '1px solid #e9ecef',
          background: '#fff',
        },
        navbar: {
          borderRight: '1px solid #e9ecef',
          background: '#fafafa',
        },
        main: {
          background: '#f4f5f7',
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap={6}>
              <IconLeaf size={20} color="#2d8a39" strokeWidth={2} />
              <Text fw={700} size="sm" style={{ letterSpacing: '-0.01em', color: '#1a1a1a' }}>
                Sistema Forestal
              </Text>
            </Group>
          </Group>

          <Menu shadow="sm" width={180} offset={4}>
            <Menu.Target>
              <Group
                gap="xs"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                p="xs"
              >
                <Avatar
                  size={28}
                  color="green"
                  style={{ borderRadius: 4, fontSize: 11, fontWeight: 700 }}
                >
                  {usuario?.nombre?.charAt(0).toUpperCase()}
                </Avatar>
                <div>
                  <Text size="xs" fw={600} lh={1.3} c="dark">{usuario?.nombre}</Text>
                  <Text size="xs" c="dimmed" lh={1.2}>{rolLabel}</Text>
                </div>
                <IconChevronDown size={13} color="#adb5bd" />
              </Group>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconLogout size={13} />}
                color="red"
                onClick={handleLogout}
                fz="xs"
              >
                Cerrar sesión
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar px="sm" py="md">
        <AppShell.Section grow component={ScrollArea}>
          <Text
            size="xs"
            fw={600}
            c="dimmed"
            px="xs"
            mb={6}
            style={{ letterSpacing: '0.07em', textTransform: 'uppercase' }}
          >
            Menú
          </Text>
          {navItems.map((item) => {
            const isActive = location.pathname === `${basePath}${item.href}` ||
              (item.href !== '' && location.pathname.startsWith(`${basePath}${item.href}`));
            return (
              <NavLink
                key={item.href}
                label={<Text size="sm" fw={isActive ? 600 : 400}>{item.label}</Text>}
                leftSection={item.icon}
                active={isActive}
                onClick={() => navigate(`${basePath}${item.href}`)}
                mb={2}
                style={{ borderRadius: 4 }}
                styles={{
                  root: {
                    color: isActive ? '#2d8a39' : '#495057',
                  },
                }}
              />
            );
          })}
        </AppShell.Section>

        <AppShell.Section>
          <Divider mb="sm" />
          <Text size="xs" c="dimmed" px="xs">v1.0.0</Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1200} mx="auto">
          <Outlet />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}

export const iconos = {
  panel:    <IconGauge size={16} strokeWidth={1.8} />,
  pdvs:     <IconBuilding size={16} strokeWidth={1.8} />,
  remitos:  <IconReceipt2 size={16} strokeWidth={1.8} />,
  camiones: <IconQrcode size={16} strokeWidth={1.8} />,
  accesos:  <IconShieldCheck size={16} strokeWidth={1.8} />,
};
