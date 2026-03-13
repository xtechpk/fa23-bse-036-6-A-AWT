// src/App.tsx
import React, { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';

const { Title, Text } = Typography;
const { Option } = Select;

interface Product {
  id: number;
  name: string;
  price: number;
}

interface UserRecord {
  id: number;
  name: string;
  address: string;
  city: string;
  phoneNumber: string;
  email: string;
  employeeId: string;
  password: string;
  role: 'SUPERADMIN' | 'STORE_ADMIN' | 'STORE_EMPLOYEE' | 'DOCTOR' | 'RECEPTIONIST' | 'LAB_ATTENDANT';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const USERS_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/users';
const PRODUCTS_URL = import.meta.env.VITE_PRODUCTS_URL || 'http://localhost:3000/api/products';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'Bearer demo-token';

const usersApi = axios.create({
  baseURL: USERS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Authorization: API_TOKEN,
  },
});

const productsApi = axios.create({ baseURL: PRODUCTS_URL });

const extractErrorMessage = (error: unknown): string => {
  const err = error as AxiosError<{ message?: string; error?: string }>;
  return err.response?.data?.message || err.response?.data?.error || 'Request failed';
};

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [findUserLoading, setFindUserLoading] = useState(false);
  const [searchedUser, setSearchedUser] = useState<UserRecord | null>(null);

  const [userForm] = Form.useForm();
  const [findUserForm] = Form.useForm();

  useEffect(() => {
    void loadProducts();
    void loadUsers();
  }, []);

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await productsApi.get('/');
      setProducts(response.data?.data || []);
    } catch (error) {
      message.error(extractErrorMessage(error));
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await usersApi.get('/');
      setUsers(response.data?.data || []);
    } catch (error) {
      message.error(extractErrorMessage(error));
    } finally {
      setLoadingUsers(false);
    }
  };

  const openCreateUserModal = () => {
    setIsEditing(false);
    setSelectedUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ isActive: true, role: 'STORE_EMPLOYEE' });
    setUserModalOpen(true);
  };

  const openEditUserModal = (record: UserRecord) => {
    setIsEditing(true);
    setSelectedUser(record);
    userForm.setFieldsValue({
      name: record.name,
      address: record.address,
      city: record.city,
      phoneNumber: record.phoneNumber,
      email: record.email,
      employeeId: record.employeeId,
      role: record.role,
      isActive: record.isActive,
      password: '',
    });
    setUserModalOpen(true);
  };

  const handleUserSubmit = async () => {
    try {
      const values = await userForm.validateFields();
      setLoadingUsers(true);

      if (isEditing && selectedUser) {
        const payload = { ...values };
        if (!payload.password) {
          delete payload.password;
        }
        await usersApi.put(`/${selectedUser.id}`, payload);
        message.success('User updated successfully');
      } else {
        await usersApi.post('/', values);
        message.success('User created successfully');
      }

      setUserModalOpen(false);
      await loadUsers();
    } catch (error) {
      message.error(extractErrorMessage(error));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      setLoadingUsers(true);
      await usersApi.delete(`/${id}`);
      message.success('User deleted successfully');
      await loadUsers();
    } catch (error) {
      message.error(extractErrorMessage(error));
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFindUserById = async () => {
    try {
      const { id } = await findUserForm.validateFields();
      setFindUserLoading(true);
      const response = await usersApi.get(`/${id}`);
      setSearchedUser(response.data?.data || null);
      message.success('User loaded using route parameter');
    } catch (error) {
      setSearchedUser(null);
      message.error(extractErrorMessage(error));
    } finally {
      setFindUserLoading(false);
    }
  };

  const userColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role' },
    { title: 'City', dataIndex: 'city', key: 'city' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (isActive ? 'Active' : 'Inactive'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: UserRecord) => (
        <Space>
          <Button onClick={() => openEditUserModal(record)}>Edit</Button>
          <Popconfirm
            title="Delete user"
            description="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1300, margin: '0 auto' }}>
      <Title level={2}>Mini Online Store API - Frontend Demo</Title>
      <Text type="secondary">Demonstrates middleware-protected users routes and modular product routes.</Text>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="Products (GET /products)">
            <List
              loading={loadingProducts}
              dataSource={products}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Text strong>{item.name}</Text>
                    <Text type="secondary">ID: {item.id}</Text>
                    <Text type="secondary">Price: ${item.price}</Text>
                  </Space>
                </List.Item>
              )}
            />
            <Button style={{ marginTop: 12 }} onClick={() => void loadProducts()}>
              Refresh Products
            </Button>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card title="Find User by ID (GET /users/:id)">
            <Space.Compact style={{ width: '100%' }}>
              <Form form={findUserForm} style={{ width: '100%' }} layout="inline">
                <Form.Item
                  name="id"
                  style={{ flex: 1, marginBottom: 0 }}
                  rules={[{ required: true, message: 'User id required' }]}
                >
                  <Input placeholder="Enter user id" type="number" />
                </Form.Item>
              </Form>
              <Button type="primary" loading={findUserLoading} onClick={() => void handleFindUserById()}>
                Search
              </Button>
            </Space.Compact>

            {searchedUser && (
              <Card size="small" style={{ marginTop: 16 }}>
                <p><strong>ID:</strong> {searchedUser.id}</p>
                <p><strong>Name:</strong> {searchedUser.name}</p>
                <p><strong>Email:</strong> {searchedUser.email}</p>
                <p><strong>Role:</strong> {searchedUser.role}</p>
              </Card>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            title="Users Management (Protected Routes)"
            extra={<Button type="primary" onClick={openCreateUserModal}>Add User</Button>}
          >
            <Table
              rowKey="id"
              loading={loadingUsers}
              columns={userColumns}
              dataSource={users}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={isEditing ? 'Update User' : 'Create User (POST /users)'}
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={() => void handleUserSubmit()}
        confirmLoading={loadingUsers}
        okText={isEditing ? 'Update' : 'Create'}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Address" rules={[{ required: true, message: 'Address is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="city" label="City" rules={[{ required: true, message: 'City is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone Number" rules={[{ required: true, message: 'Phone number is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Invalid email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="employeeId" label="Employee ID" rules={[{ required: true, message: 'Employee ID is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={isEditing ? 'Password (optional)' : 'Password'}
            rules={isEditing ? [] : [{ required: true, message: 'Password is required' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Role is required' }]}>
            <Select>
              <Option value="SUPERADMIN">SUPERADMIN</Option>
              <Option value="STORE_ADMIN">STORE_ADMIN</Option>
              <Option value="STORE_EMPLOYEE">STORE_EMPLOYEE</Option>
              <Option value="DOCTOR">DOCTOR</Option>
              <Option value="RECEPTIONIST">RECEPTIONIST</Option>
              <Option value="LAB_ATTENDANT">LAB_ATTENDANT</Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="Is Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default App;