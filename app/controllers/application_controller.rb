class ApplicationController < ActionController::Base
  allow_browser versions: :modern

  layout :set_layout

  before_action :configure_permitted_parameters, if: :devise_controller?

  protected

  def after_sign_in_path_for(resource)
    dashboard_path
  end

  def configure_permitted_parameters
    devise_parameter_sanitizer.permit(:sign_up, keys: [ :name ])
    devise_parameter_sanitizer.permit(:account_update, keys: [ :name, :bio, :avatar ])
  end

  def turbo_refresh_or_redirect(url, notice: nil)
    response.headers["Turbo-Refresh-Method"] = "morph"
    response.headers["Turbo-Refresh-Scroll"] = "preserve"
    flash[:notice] = notice if notice
    render :show, status: :see_other
  end

  private

  def set_layout
    if devise_controller?
      "devise"
    elsif user_signed_in?
      "authenticated"
    else
      "application"
    end
  end
end
