import { Input } from 'antd';
import type { InputProps } from 'antd';

interface AppInputProps extends Omit<InputProps, 'size'> {
  type?: 'text' | 'email' | 'password' | 'search';
}

const AppInput = ({ type = 'text', className, ...rest }: AppInputProps) => {
  const mergedClassName = `w-full ${className || ''}`.trim();

  if (type === 'password') {
    return <Input.Password {...rest} className={mergedClassName} size="large" />;
  }

  return <Input {...rest} type={type} className={mergedClassName} size="large" />;
};

export default AppInput;
