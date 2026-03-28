import { Select } from 'antd';
import type { SelectProps } from 'antd';

const AppSelect = <T extends string | number | Array<string | number> = string>(
  props: SelectProps<T>
) => {
  return (
    <Select
      size="large"
      showSearch
      optionFilterProp="label"
      filterOption={(input, option) =>
        String(option?.label || '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      {...props}
    />
  );
};

export default AppSelect;
