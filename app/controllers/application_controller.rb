class ApplicationController < ActionController::Base
  allow_browser versions: :modern

  layout :set_layout

  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [:name])
    devise_parameter_sanitizer.permit(:account_update, keys: [:name, :bio, :avatar])
  end

  private

  def set_layout
    devise_controller? ? "devise" : "application"
  end
end
