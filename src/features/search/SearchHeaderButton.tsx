import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import { IconButton } from '@/components';

function SearchHeaderButton() {
  const navigation = useNavigation();
  return (
    <IconButton
      icon={Search}
      accessibilityLabel="Search"
      color="primary"
      onPress={() => navigation.navigate('Search')}
      testID="open-search"
    />
  );
}

// headerLeft is called as a function: render the button as a component.
export const renderSearchButton = () => <SearchHeaderButton />;
