const prisma = require('../prisma/client');

const ALLOWED_ROLES = [
  'SUPERADMIN',
  'STORE_ADMIN',
  'STORE_EMPLOYEE',
  'DOCTOR',
  'RECEPTIONIST',
  'LAB_ATTENDANT'
];

const parseId = (idValue) => {
  const id = Number(idValue);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const sanitizePayload = (payload, isCreate = false) => {
  const data = {};

  const fields = [
    'name',
    'address',
    'city',
    'phoneNumber',
    'email',
    'employeeId',
    'password',
    'role',
    'isActive'
  ];

  fields.forEach((field) => {
    if (payload[field] !== undefined) {
      data[field] = payload[field];
    }
  });

  if (isCreate && data.isActive === undefined) {
    data.isActive = true;
  }

  return data;
};

const validateCreatePayload = (payload) => {
  const required = [
    'name',
    'address',
    'city',
    'phoneNumber',
    'email',
    'employeeId',
    'password',
    'role'
  ];

  for (const field of required) {
    if (!payload[field]) {
      return `${field} is required`;
    }
  }

  if (!ALLOWED_ROLES.includes(payload.role)) {
    return `role must be one of: ${ALLOWED_ROLES.join(', ')}`;
  }

  return null;
};

const validateUpdatePayload = (payload) => {
  if (payload.role && !ALLOWED_ROLES.includes(payload.role)) {
    return `role must be one of: ${ALLOWED_ROLES.join(', ')}`;
  }
  return null;
};

const formatPrismaError = (error) => {
  if (error && error.code === 'P2002') {
    return 'Unique constraint failed (email or employeeId already exists)';
  }
  return 'Database operation failed';
};

const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'desc' }
    });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: formatPrismaError(error)
    });
  }
};

const getUserById = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id'
    });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: formatPrismaError(error)
    });
  }
};

const createUser = async (req, res) => {
  const payload = sanitizePayload(req.body, true);
  const validationError = validateCreatePayload(payload);

  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError
    });
  }

  try {
    const user = await prisma.user.create({
      data: payload
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: user
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: formatPrismaError(error)
    });
  }
};

const updateUser = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id'
    });
  }

  const payload = sanitizePayload(req.body);

  if (Object.keys(payload).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid fields provided for update'
    });
  }

  const validationError = validateUpdatePayload(payload);
  if (validationError) {
    return res.status(400).json({
      success: false,
      message: validationError
    });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = await prisma.user.update({
      where: { id },
      data: payload
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: formatPrismaError(error)
    });
  }
};

const deleteUser = async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user id'
    });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await prisma.user.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: formatPrismaError(error)
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
