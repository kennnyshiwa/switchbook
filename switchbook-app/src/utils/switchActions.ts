export async function deleteSwitch(switchId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/switches/${switchId}`, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}